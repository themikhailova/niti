"""
services/recommendation_engine.py
══════════════════════════════════════════════════════════════════════════════
Гибридный движок рекомендаций NITI.

Архитектура (три слоя):
  1. Content-based  — sentence-transformer (MiniLM) embeddings текста + mood
  2. Collaborative  — user-item матрица лайков (cosine similarity)
  3. Emotional      — буст/штраф по совпадению mood

Финальный score = α·content_sim + β·collab_score + γ·mood_match + δ·freshness

Особенности:
  - Graceful degradation: если sentence-transformers не установлен → TF-IDF
  - Холодный старт: новым пользователям (0 лайков, 0 постов) → популярные + свежие
  - Кеш эмбеддингов в памяти (TTL 10 минут), сбрасывается при новом посте
  - Полностью синхронный (нет async), работает внутри Flask app context
  - Поле user_id (НЕ author_id) — согласно models.py Post.user_id
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Optional

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Веса финального score (сумма = 1.0)
# ─────────────────────────────────────────────────────────────────────────────
ALPHA = 0.35   # content-based similarity
BETA  = 0.25   # collaborative filtering
GAMMA = 0.20   # emotional / mood match
DELTA = 0.20   # freshness (экспоненциальный decay)

# Decay-период свежести: 48 часов → пост двухдневной давности = score ≈ 0.37
FRESHNESS_DECAY_HOURS = 48.0

# Mood-матрица аффинности: насколько один mood совместим с другим (0..1)
# Симметричная. Диагональ = 1.0 (точное совпадение).
_MOOD_AFFINITY: dict[tuple[str, str], float] = {
    ('joyful',      'energetic'):  0.7,
    ('joyful',      'inspired'):   0.6,
    ('calm',        'reflective'): 0.7,
    ('calm',        'melancholic'):0.4,
    ('reflective',  'melancholic'):0.6,
    ('reflective',  'inspired'):   0.5,
    ('energetic',   'joyful'):     0.7,
    ('inspired',    'joyful'):     0.6,
    ('inspired',    'energetic'):  0.5,
    ('melancholic', 'calm'):       0.4,
    ('melancholic', 'reflective'): 0.6,
}

ALL_MOODS = ['joyful', 'calm', 'reflective', 'energetic', 'melancholic', 'inspired']

# ─────────────────────────────────────────────────────────────────────────────
# Кеш эмбеддингов
# ─────────────────────────────────────────────────────────────────────────────
_embed_cache: dict[int, np.ndarray] = {}   # post_id → embedding vector
_cache_ts: float = 0.0
_CACHE_TTL = 600  # секунд

def _invalidate_cache() -> None:
    global _embed_cache, _cache_ts
    _embed_cache = {}
    _cache_ts = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Загрузка энкодера (lazy, singleton)
# ─────────────────────────────────────────────────────────────────────────────
_encoder = None
_USE_TRANSFORMERS = False

def _get_encoder():
    """
    Возвращает sentence_transformers.SentenceTransformer или None.
    При первом вызове пытается загрузить модель.
    Если пакет не установлен — возвращает None (fallback на TF-IDF).
    """
    global _encoder, _USE_TRANSFORMERS
    if _encoder is not None:
        return _encoder
    if _USE_TRANSFORMERS is False and _encoder is None:
        # Ещё не пробовали загружать
        pass
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("[RecoEngine] Loading MiniLM encoder…")
        _encoder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        _USE_TRANSFORMERS = True
        logger.info("[RecoEngine] MiniLM loaded ✓")
    except Exception as exc:
        logger.warning(f"[RecoEngine] sentence-transformers unavailable ({exc}), using TF-IDF")
        _encoder = None
        _USE_TRANSFORMERS = False
    return _encoder


def _tfidf_embed(texts: list[str]) -> np.ndarray:
    """Fallback: TF-IDF + L2-normalize → плотный вектор (n, max_features)."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    if not texts:
        return np.zeros((0, 1))
    vec = TfidfVectorizer(max_features=256, ngram_range=(1, 2),
                          sublinear_tf=True, min_df=1)
    try:
        mat = vec.fit_transform(texts).toarray().astype(np.float32)
        return normalize(mat, norm='l2')
    except Exception:
        return np.zeros((len(texts), 256), dtype=np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Вспомогательные функции
# ─────────────────────────────────────────────────────────────────────────────

def _post_text(post) -> str:
    """Строит текст для эмбеддинга из всех доступных полей поста."""
    parts: list[str] = []
    if post.title:
        parts.append(post.title)
    if post.content:
        parts.append(post.content)
    if post.mood:
        mood_val = post.mood.value if hasattr(post.mood, 'value') else str(post.mood)
        parts.append(mood_val)
    if post.tags:
        parts.extend(t.name for t in post.tags)
    if post.board and post.board.name:
        parts.append(post.board.name)
        if post.board.tags:
            parts.extend(post.board.tags)
    return ' '.join(parts) if parts else 'post'


def _mood_affinity(mood_a: Optional[str], mood_b: Optional[str]) -> float:
    """0..1. 1.0 = совпадение, матрица для близких mood, 0.1 для несвязанных."""
    if not mood_a or not mood_b:
        return 0.3   # нейтральный score если mood неизвестен
    if mood_a == mood_b:
        return 1.0
    key  = (mood_a, mood_b)
    key2 = (mood_b, mood_a)
    return _MOOD_AFFINITY.get(key, _MOOD_AFFINITY.get(key2, 0.1))


def _freshness(post, now: datetime) -> float:
    """Экспоненциальный decay. Свежий пост (0ч) → 1.0, через 48ч → ≈0.37."""
    hours = max(0.0, (now - post.created_at).total_seconds() / 3600)
    return float(np.exp(-hours / FRESHNESS_DECAY_HOURS))


def _get_mood_str(post) -> Optional[str]:
    m = post.mood
    if m is None:
        return None
    return m.value if hasattr(m, 'value') else str(m)


# ─────────────────────────────────────────────────────────────────────────────
# Построение профиля пользователя
# ─────────────────────────────────────────────────────────────────────────────

def _build_user_profile(user, all_posts: list) -> dict:
    """
    Возвращает профиль пользователя:
      - liked_post_ids: set[int]
      - mood_histogram: dict[str, float] — нормированные частоты mood
      - dominant_mood: str | None
      - own_post_ids: set[int]
      - following_ids: set[int]
    """
    from models import Reaction
    liked_ids = {
        r.post_id
        for r in Reaction.query.filter_by(user_id=user.id).all()
    }

    own_ids = {p.id for p in user.posts.all()}

    following_ids: set[int] = set()
    try:
        following_ids = {u.id for u in user.following.all()}
    except Exception:
        pass

    # Mood-гистограмма: считаем по лайкнутым + своим постам
    mood_counts: dict[str, float] = {m: 0.0 for m in ALL_MOODS}
    post_map = {p.id: p for p in all_posts}

    for pid in liked_ids | own_ids:
        p = post_map.get(pid)
        if p:
            m = _get_mood_str(p)
            if m and m in mood_counts:
                mood_counts[m] += 1.0

    total = sum(mood_counts.values())
    if total > 0:
        mood_hist = {m: v / total for m, v in mood_counts.items()}
    else:
        mood_hist = {m: 1.0 / len(ALL_MOODS) for m in ALL_MOODS}

    dominant = max(mood_hist, key=mood_hist.get) if total > 0 else None

    return {
        'liked_post_ids': liked_ids,
        'own_post_ids':   own_ids,
        'mood_histogram': mood_hist,
        'dominant_mood':  dominant,
        'following_ids':  following_ids,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Content-based: эмбеддинги
# ─────────────────────────────────────────────────────────────────────────────

def _get_embeddings(posts: list) -> np.ndarray:
    """
    Возвращает матрицу (n_posts, dim) эмбеддингов.
    Использует кеш. При промахе — батч-кодирование.
    """
    global _cache_ts

    now = time.time()
    if now - _cache_ts > _CACHE_TTL:
        _invalidate_cache()
        _cache_ts = now

    missing_idx = [i for i, p in enumerate(posts) if p.id not in _embed_cache]

    if missing_idx:
        missing_posts = [posts[i] for i in missing_idx]
        texts = [_post_text(p) for p in missing_posts]

        enc = _get_encoder()
        if enc is not None:
            try:
                vecs = enc.encode(texts, batch_size=64,
                                  show_progress_bar=False,
                                  normalize_embeddings=True)
                vecs = vecs.astype(np.float32)
            except Exception as e:
                logger.warning(f"[RecoEngine] Encoder error: {e}, using TF-IDF")
                vecs = _tfidf_embed(texts)
        else:
            vecs = _tfidf_embed(texts)

        for i, (idx, post) in enumerate(zip(missing_idx, missing_posts)):
            _embed_cache[post.id] = vecs[i]

    # Собираем в матрицу в порядке posts
    rows = [_embed_cache[p.id] for p in posts]
    return np.stack(rows, axis=0)  # (n, dim)


def _content_scores(candidate_posts: list, profile_posts: list) -> np.ndarray:
    """
    Для каждого кандидата: max cosine_similarity с любым постом профиля.
    profile_posts = лайкнутые + свои посты пользователя.
    """
    if not profile_posts:
        return np.zeros(len(candidate_posts), dtype=np.float32)

    all_posts = candidate_posts + profile_posts
    all_embs  = _get_embeddings(all_posts)

    cand_embs    = all_embs[:len(candidate_posts)]
    profile_embs = all_embs[len(candidate_posts):]

    # cosine sim matrix: (n_cand, n_profile)
    sim = cosine_similarity(cand_embs, profile_embs)   # уже L2-нормировано
    return sim.max(axis=1).astype(np.float32)          # (n_cand,)


# ─────────────────────────────────────────────────────────────────────────────
# Collaborative filtering
# ─────────────────────────────────────────────────────────────────────────────

def _collab_scores(candidate_posts: list, user_id: int) -> np.ndarray:
    """
    User-item collaborative filtering на основе лайков.
    Идея: находим пользователей с похожими вкусами (по лайкам),
    смотрим что они лайкали из кандидатов → score.

    При малом числе данных возвращает popularity score (нормированный).
    """
    from models import Reaction, db
    from sqlalchemy import func

    cand_ids = [p.id for p in candidate_posts]
    if not cand_ids:
        return np.array([], dtype=np.float32)

    # Считаем общее число лайков на каждый пост-кандидат
    counts = dict(
        db.session.query(Reaction.post_id, func.count(Reaction.id))
        .filter(Reaction.post_id.in_(cand_ids))
        .group_by(Reaction.post_id)
        .all()
    )

    try:
        # ── Настоящий CF: user-item матрица ──────────────────────────────
        # Все пользователи, которые лайкали хоть что-то
        all_reactions = Reaction.query.all()
        if not all_reactions:
            raise ValueError("no reactions")

        # Уникальные пользователи и посты
        u_ids = sorted({r.user_id for r in all_reactions})
        p_ids = sorted({r.post_id for r in all_reactions} | set(cand_ids))
        u_idx = {u: i for i, u in enumerate(u_ids)}
        p_idx = {p: i for i, p in enumerate(p_ids)}

        # Матрица (n_users, n_posts) — бинарная
        mat = np.zeros((len(u_ids), len(p_ids)), dtype=np.float32)
        for r in all_reactions:
            if r.user_id in u_idx and r.post_id in p_idx:
                mat[u_idx[r.user_id], p_idx[r.post_id]] = 1.0

        # Вектор текущего пользователя
        if user_id not in u_idx:
            raise ValueError("cold start user")

        user_vec = mat[u_idx[user_id]].reshape(1, -1)   # (1, n_posts)

        # Похожие пользователи
        sim_users = cosine_similarity(user_vec, mat)[0]  # (n_users,)

        # CF-score для кандидатов: взвешенная сумма по похожим пользователям
        scores = np.zeros(len(candidate_posts), dtype=np.float32)
        for i, post in enumerate(candidate_posts):
            if post.id not in p_idx:
                scores[i] = 0.0
                continue
            pi = p_idx[post.id]
            # Взвешенная сумма: похожесть * лайкнул ли похожий пользователь
            scores[i] = float(np.dot(sim_users, mat[:, pi]))

        # Нормируем в [0, 1]
        max_s = scores.max()
        if max_s > 0:
            scores /= max_s

    except Exception:
        # Fallback: popularity (нормированный count лайков)
        max_count = max(counts.values()) if counts else 1
        scores = np.array(
            [counts.get(p.id, 0) / max_count for p in candidate_posts],
            dtype=np.float32,
        )

    return scores


# ─────────────────────────────────────────────────────────────────────────────
# Emotional layer
# ─────────────────────────────────────────────────────────────────────────────

def _emotional_scores(candidate_posts: list,
                      mood_hist: dict[str, float],
                      dominant_mood: Optional[str],
                      requested_mood: Optional[str]) -> np.ndarray:
    """
    Для каждого кандидата вычисляет emotional score:
      - если запрошен конкретный mood filter → жёсткое совпадение важнее
      - иначе → взвешенная аффинность по гистограмме вкусов пользователя
    """
    scores = np.zeros(len(candidate_posts), dtype=np.float32)
    for i, post in enumerate(candidate_posts):
        post_mood = _get_mood_str(post)

        if requested_mood:
            # Жёсткий фильтр: аффинность с запрошенным mood
            scores[i] = _mood_affinity(post_mood, requested_mood)
        else:
            # Мягкий: взвешенная сумма аффинности по всем mood пользователя
            s = 0.0
            for m, weight in mood_hist.items():
                s += weight * _mood_affinity(post_mood, m)
            scores[i] = s

    return scores.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Публичный API движка
# ─────────────────────────────────────────────────────────────────────────────

def score_and_rank(
    candidate_posts: list,
    current_user,
    requested_mood: Optional[str] = None,
    exclude_ids: Optional[set] = None,
) -> list:
    """
    Основная функция движка.

    Параметры
    ---------
    candidate_posts  — список Post (уже отфильтрован по visibility)
    current_user     — User | None (None → гость, возвращает по популярности)
    requested_mood   — фильтр mood от пользователя (из ?mood=calm)
    exclude_ids      — set[int] уже показанных post_id (для пагинации)

    Возвращает
    ----------
    Список Post отсортированный по убыванию финального score.
    """
    if not candidate_posts:
        return []

    # Исключаем уже виденные
    if exclude_ids:
        candidate_posts = [p for p in candidate_posts if p.id not in exclude_ids]

    # Гости: простая сортировка (популярность + свежесть)
    if current_user is None:
        now = datetime.utcnow()
        return _rank_cold(candidate_posts, now)

    # ── Профиль пользователя ─────────────────────────────────────────────
    profile = _build_user_profile(current_user, candidate_posts)
    liked   = profile['liked_post_ids']
    own     = profile['own_post_ids']

    # Посты для user-профиля в content-based (лайкнутые + свои)
    all_post_map = {p.id: p for p in candidate_posts}
    profile_posts = [
        all_post_map[pid] for pid in (liked | own)
        if pid in all_post_map
    ]

    # Холодный старт: нет лайков, нет постов → опираемся только на свежесть+популярность
    cold_start = len(liked) == 0 and len(own) == 0

    now = datetime.utcnow()

    # ── Четыре компонента score ──────────────────────────────────────────
    try:
        if cold_start or not profile_posts:
            content = np.zeros(len(candidate_posts), dtype=np.float32)
        else:
            content = _content_scores(candidate_posts, profile_posts)
    except Exception as e:
        logger.warning(f"[RecoEngine] content_scores error: {e}")
        content = np.zeros(len(candidate_posts), dtype=np.float32)

    try:
        collab = _collab_scores(candidate_posts, current_user.id)
    except Exception as e:
        logger.warning(f"[RecoEngine] collab_scores error: {e}")
        collab = np.zeros(len(candidate_posts), dtype=np.float32)

    emotional = _emotional_scores(
        candidate_posts,
        profile['mood_histogram'],
        profile['dominant_mood'],
        requested_mood,
    )

    freshness = np.array(
        [_freshness(p, now) for p in candidate_posts],
        dtype=np.float32,
    )

    # ── Финальный score ──────────────────────────────────────────────────
    weights = (ALPHA, BETA, GAMMA, DELTA)
    if cold_start:
        # При cold start перераспределяем: больше вес свежести и эмоций
        weights = (0.0, 0.15, 0.35, 0.50)

    final = (
        weights[0] * content  +
        weights[1] * collab   +
        weights[2] * emotional +
        weights[3] * freshness
    )

    # ── Небольшой буст подписок ──────────────────────────────────────────
    following_ids = profile['following_ids']
    for i, post in enumerate(candidate_posts):
        if post.user_id in following_ids:
            final[i] = min(1.0, final[i] + 0.08)

    # Сортируем по убыванию
    order = np.argsort(final)[::-1]
    return [candidate_posts[i] for i in order]


def _rank_cold(posts: list, now: datetime) -> list:
    """
    Ранжирование для гостей / cold-start:
    popularity (число реакций) + freshness.
    """
    from models import Reaction, db
    from sqlalchemy import func

    post_ids = [p.id for p in posts]
    counts = {}
    if post_ids:
        rows = (
            db.session.query(Reaction.post_id, func.count(Reaction.id))
            .filter(Reaction.post_id.in_(post_ids))
            .group_by(Reaction.post_id)
            .all()
        )
        counts = {r[0]: r[1] for r in rows}

    max_c = max(counts.values(), default=1)

    def score(post):
        pop = counts.get(post.id, 0) / max_c
        fresh = _freshness(post, now)
        return 0.5 * pop + 0.5 * fresh

    return sorted(posts, key=score, reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Вызывается из posts.py при создании нового поста → сброс кеша
# ─────────────────────────────────────────────────────────────────────────────

def on_post_created():
    """Инвалидирует кеш эмбеддингов при публикации нового поста."""
    _invalidate_cache()


# ═════════════════════════════════════════════════════════════════════════════
# BOARD RECOMMENDATIONS
# ═════════════════════════════════════════════════════════════════════════════
#
# Два публичных API:
#   rank_boards_personalized(boards, current_user)  → Левая колонка «Рекомендуемые»
#   rank_boards_trending(boards)                    → Правая колонка «В тренде»
#
# Веса для персональных досок (α+β+γ+δ = 1.0):
#   α_B = 0.35  content-based (сходство доски с интересами пользователя)
#   β_B = 0.25  collaborative (кто ещё подписан на похожие доски)
#   γ_B = 0.20  emotional     (настроение досок пользователя vs доска)
#   δ_B = 0.20  freshness / activity
# ─────────────────────────────────────────────────────────────────────────────

ALPHA_B = 0.35
BETA_B  = 0.25
GAMMA_B = 0.20
DELTA_B = 0.20

# Decay для досок: 7 дней (доска — долгоживущий объект)
BOARD_FRESHNESS_DECAY_HOURS = 7 * 24.0

# Окно для momentum: подписки за последние 48 часов
MOMENTUM_WINDOW_HOURS = 48.0

# Кеш эмбеддингов досок (отдельный от постового)
_board_embed_cache: dict[int, np.ndarray] = {}
_board_cache_ts: float = 0.0


def _invalidate_board_cache() -> None:
    global _board_embed_cache, _board_cache_ts
    _board_embed_cache = {}
    _board_cache_ts = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Текст доски для эмбеддинга
# ─────────────────────────────────────────────────────────────────────────────

def _board_text(board) -> str:
    """
    Строит текстовое представление доски для эмбеддинга.
    Берёт: название (×2 для весовой важности) + описание + теги + mood-суффикс из постов.
    """
    parts: list[str] = []

    # Название повторяем дважды — оно важнее описания
    if board.name:
        parts.append(board.name)
        parts.append(board.name)

    if board.description:
        parts.append(board.description)

    # Теги (хранятся как JSON-список строк в Board.tags)
    if board.tags:
        tags = board.tags if isinstance(board.tags, list) else []
        parts.extend(tags)

    # Dominant mood из постов доски (берём первые 20 для скорости)
    try:
        board_posts = board.posts.limit(20).all()
        mood_counter: dict[str, int] = {}
        for p in board_posts:
            m = _get_mood_str(p)
            if m:
                mood_counter[m] = mood_counter.get(m, 0) + 1
        if mood_counter:
            dominant = max(mood_counter, key=mood_counter.get)
            parts.append(dominant)
    except Exception:
        pass

    return ' '.join(parts) if parts else 'board'


def _board_dominant_mood(board) -> str | None:
    """Вычисляет доминирующий mood из постов доски."""
    try:
        board_posts = board.posts.limit(30).all()
        mood_counter: dict[str, int] = {}
        for p in board_posts:
            m = _get_mood_str(p)
            if m:
                mood_counter[m] = mood_counter.get(m, 0) + 1
        if mood_counter:
            return max(mood_counter, key=mood_counter.get)
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Эмбеддинги досок (отдельный кеш)
# ─────────────────────────────────────────────────────────────────────────────

def _get_board_embeddings(boards: list) -> np.ndarray:
    """Батч-кодирование досок. Кеш TTL = CACHE_TTL (10 мин)."""
    global _board_cache_ts

    now_t = time.time()
    if now_t - _board_cache_ts > _CACHE_TTL:
        _invalidate_board_cache()
        _board_cache_ts = now_t

    missing_idx = [i for i, b in enumerate(boards) if b.id not in _board_embed_cache]

    if missing_idx:
        missing_boards = [boards[i] for i in missing_idx]
        texts = [_board_text(b) for b in missing_boards]

        enc = _get_encoder()
        if enc is not None:
            try:
                vecs = enc.encode(texts, batch_size=32,
                                  show_progress_bar=False,
                                  normalize_embeddings=True)
                vecs = vecs.astype(np.float32)
            except Exception as e:
                logger.warning(f"[RecoEngine-Board] Encoder error: {e}, TF-IDF fallback")
                vecs = _tfidf_embed(texts)
        else:
            vecs = _tfidf_embed(texts)

        for i, board in enumerate(missing_boards):
            _board_embed_cache[board.id] = vecs[i]

    rows = [_board_embed_cache[b.id] for b in boards]
    return np.stack(rows, axis=0)


# ─────────────────────────────────────────────────────────────────────────────
# Построение профиля пользователя для досок
# ─────────────────────────────────────────────────────────────────────────────

def _build_user_board_profile(user, candidate_boards: list) -> dict:
    """
    Профиль пользователя относительно досок:
      - followed_board_ids: set[int]   — на что уже подписан
      - board_mood_histogram: dict     — mood доминирующий в подписанных досках
      - own_board_ids: set[int]        — доски, которые сам создал
      - post_mood_histogram: dict      — mood из постов/лайков (из постового профиля)
    """
    try:
        followed_ids = {b.id for b in user.followed_boards.all()}
    except Exception:
        followed_ids = set()

    try:
        own_board_ids = {b.id for b in user.boards.all()}
    except Exception:
        own_board_ids = set()

    # Mood из подписанных досок
    mood_counts: dict[str, float] = {m: 0.0 for m in ALL_MOODS}
    for b in candidate_boards:
        if b.id in followed_ids:
            dm = _board_dominant_mood(b)
            if dm and dm in mood_counts:
                mood_counts[dm] += 1.0

    total = sum(mood_counts.values())
    if total > 0:
        board_mood_hist = {m: v / total for m, v in mood_counts.items()}
    else:
        # Fallback: равномерное распределение
        board_mood_hist = {m: 1.0 / len(ALL_MOODS) for m in ALL_MOODS}

    # Mood из постов/лайков пользователя (переиспользуем логику постового профиля)
    from models import Reaction
    liked_post_ids = {r.post_id for r in Reaction.query.filter_by(user_id=user.id).all()}
    own_post_ids   = {p.id for p in user.posts.all()}

    post_mood_counts: dict[str, float] = {m: 0.0 for m in ALL_MOODS}
    # Берём посты из кандидатских досок для mood-сигнала
    all_board_posts = []
    for b in candidate_boards:
        try:
            all_board_posts.extend(b.posts.limit(10).all())
        except Exception:
            pass

    post_map = {p.id: p for p in all_board_posts}
    for pid in liked_post_ids | own_post_ids:
        p = post_map.get(pid)
        if p:
            m = _get_mood_str(p)
            if m and m in post_mood_counts:
                post_mood_counts[m] += 1.0

    total2 = sum(post_mood_counts.values())
    if total2 > 0:
        post_mood_hist = {m: v / total2 for m, v in post_mood_counts.items()}
    else:
        post_mood_hist = {m: 1.0 / len(ALL_MOODS) for m in ALL_MOODS}

    # Объединяем: 60% board mood + 40% post mood
    combined_mood = {
        m: 0.6 * board_mood_hist[m] + 0.4 * post_mood_hist[m]
        for m in ALL_MOODS
    }
    dominant = max(combined_mood, key=combined_mood.get) if (total + total2) > 0 else None

    return {
        'followed_board_ids': followed_ids,
        'own_board_ids':      own_board_ids,
        'mood_histogram':     combined_mood,
        'dominant_mood':      dominant,
        'cold_start':         len(followed_ids) == 0 and len(own_board_ids) == 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Content-based для досок
# ─────────────────────────────────────────────────────────────────────────────

def _board_content_scores(candidate_boards: list, profile_boards: list) -> np.ndarray:
    """
    Max cosine sim каждой доски-кандидата с досками профиля пользователя
    (доски на которые подписан + создал).
    """
    if not profile_boards:
        return np.zeros(len(candidate_boards), dtype=np.float32)

    all_boards = candidate_boards + profile_boards
    all_embs   = _get_board_embeddings(all_boards)

    cand_embs    = all_embs[:len(candidate_boards)]
    profile_embs = all_embs[len(candidate_boards):]

    sim = cosine_similarity(cand_embs, profile_embs)
    return sim.max(axis=1).astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Collaborative filtering для досок
# ─────────────────────────────────────────────────────────────────────────────

def _board_collab_scores(candidate_boards: list, user_id: int) -> np.ndarray:
    """
    User-board CF: кто ещё подписан на те же доски → что они ещё смотрят.

    Матрица: пользователи × доски (binary: подписан / нет).
    При недостатке данных → popularity fallback (followers_count).
    """
    from models import db
    from sqlalchemy import text as sa_text

    cand_ids = [b.id for b in candidate_boards]
    if not cand_ids:
        return np.array([], dtype=np.float32)

    try:
        # Загружаем все подписки на доски из таблицы board_followers
        rows = db.session.execute(
            sa_text('SELECT user_id, board_id FROM board_followers')
        ).fetchall()

        if not rows:
            raise ValueError("no board_followers data")

        u_ids = sorted({r[0] for r in rows})
        b_ids = sorted({r[1] for r in rows} | set(cand_ids))
        u_idx = {u: i for i, u in enumerate(u_ids)}
        b_idx = {b: i for i, b in enumerate(b_ids)}

        mat = np.zeros((len(u_ids), len(b_ids)), dtype=np.float32)
        for r in rows:
            if r[0] in u_idx and r[1] in b_idx:
                mat[u_idx[r[0]], b_idx[r[1]]] = 1.0

        if user_id not in u_idx:
            raise ValueError("user has no board subscriptions")

        user_vec  = mat[u_idx[user_id]].reshape(1, -1)
        sim_users = cosine_similarity(user_vec, mat)[0]  # (n_users,)

        scores = np.zeros(len(candidate_boards), dtype=np.float32)
        for i, board in enumerate(candidate_boards):
            if board.id not in b_idx:
                scores[i] = 0.0
                continue
            bi = b_idx[board.id]
            scores[i] = float(np.dot(sim_users, mat[:, bi]))

        max_s = scores.max()
        if max_s > 0:
            scores /= max_s

    except Exception:
        # Fallback: нормированный followers_count
        max_f = max((b.followers_count for b in candidate_boards), default=1)
        max_f = max(max_f, 1)
        scores = np.array(
            [b.followers_count / max_f for b in candidate_boards],
            dtype=np.float32,
        )

    return scores


# ─────────────────────────────────────────────────────────────────────────────
# Emotional layer для досок
# ─────────────────────────────────────────────────────────────────────────────

def _board_emotional_scores(candidate_boards: list,
                             mood_hist: dict[str, float]) -> np.ndarray:
    """
    Взвешенная аффинность доминирующего mood доски с mood-гистограммой пользователя.
    """
    scores = np.zeros(len(candidate_boards), dtype=np.float32)
    for i, board in enumerate(candidate_boards):
        board_mood = _board_dominant_mood(board)
        s = 0.0
        for m, weight in mood_hist.items():
            s += weight * _mood_affinity(board_mood, m)
        scores[i] = s
    return scores.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Freshness / Activity для досок
# ─────────────────────────────────────────────────────────────────────────────

def _board_freshness(board, now: datetime) -> float:
    """
    Активность доски = decay по дате создания + буст за недавние посты.
    Формула: 0.5 * creation_decay + 0.5 * last_post_decay
    """
    hours_since_create = max(
        0.0, (now - board.created_at).total_seconds() / 3600
    ) if board.created_at else BOARD_FRESHNESS_DECAY_HOURS * 4
    creation_decay = float(np.exp(-hours_since_create / BOARD_FRESHNESS_DECAY_HOURS))

    # Дата последнего поста
    last_post_decay = 0.0
    try:
        last_post = board.posts.order_by('created_at desc').first()
        if last_post:
            hours_since_post = max(
                0.0, (now - last_post.created_at).total_seconds() / 3600
            )
            last_post_decay = float(np.exp(-hours_since_post / (BOARD_FRESHNESS_DECAY_HOURS / 2)))
    except Exception:
        pass

    return 0.5 * creation_decay + 0.5 * last_post_decay


# ─────────────────────────────────────────────────────────────────────────────
# Momentum (для «В тренде»)
# ─────────────────────────────────────────────────────────────────────────────

def _board_momentum(candidate_boards: list, now: datetime) -> np.ndarray:
    """
    Скорость роста подписчиков за последние MOMENTUM_WINDOW_HOURS часов.
    Использует таблицу board_followers.created_at.

    При отсутствии данных о времени подписки → нормированный followers_count.
    """
    from models import db
    from sqlalchemy import text as sa_text
    from datetime import timedelta

    window_start = now - timedelta(hours=MOMENTUM_WINDOW_HOURS)
    cand_ids = [b.id for b in candidate_boards]

    try:
        rows = db.session.execute(
            sa_text(
                'SELECT board_id, COUNT(*) as cnt '
                'FROM board_followers '
                'WHERE board_id IN :ids AND created_at >= :since '
                'GROUP BY board_id'
            ),
            {'ids': tuple(cand_ids) if len(cand_ids) > 1 else (cand_ids[0],),
             'since': window_start.isoformat()}
        ).fetchall()

        recent_counts = {r[0]: r[1] for r in rows}
    except Exception:
        recent_counts = {}

    # Если нет данных created_at в board_followers — fallback
    if not recent_counts:
        max_f = max((b.followers_count for b in candidate_boards), default=1)
        max_f = max(max_f, 1)
        return np.array([b.followers_count / max_f for b in candidate_boards],
                        dtype=np.float32)

    max_m = max(recent_counts.values(), default=1)
    return np.array(
        [recent_counts.get(b.id, 0) / max_m for b in candidate_boards],
        dtype=np.float32,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Публичный API: персональные рекомендации досок
# ─────────────────────────────────────────────────────────────────────────────

def rank_boards_personalized(
    candidate_boards: list,
    current_user,
    exclude_own: bool = True,
) -> list:
    """
    Персонализированное ранжирование досок (левая колонка «Рекомендуемые»).

    Параметры
    ---------
    candidate_boards — список Board (уже публичные)
    current_user     — User | None (None → fallback к trending)
    exclude_own      — исключить собственные доски пользователя (default True)

    Возвращает
    ----------
    Отсортированный список Board.
    """
    if not candidate_boards:
        return []

    if current_user is None:
        # Гости → глобальный trending
        return rank_boards_trending(candidate_boards)

    # Исключаем уже подписанные и (опционально) собственные
    try:
        followed_ids = {b.id for b in current_user.followed_boards.all()}
    except Exception:
        followed_ids = set()

    own_ids: set[int] = set()
    if exclude_own:
        try:
            own_ids = {b.id for b in current_user.boards.all()}
        except Exception:
            pass

    # Доски которые уже "освоены" пользователем — не показываем
    skip = followed_ids | own_ids
    candidates = [b for b in candidate_boards if b.id not in skip]

    if not candidates:
        # Если всё уже подписано — показываем всё кроме своих
        candidates = [b for b in candidate_boards if b.id not in own_ids]

    if not candidates:
        return candidate_boards

    # Профиль пользователя
    profile = _build_user_board_profile(current_user, candidate_boards)
    cold_start = profile['cold_start']

    # Доски профиля: подписанные + свои (для content-based)
    all_board_map = {b.id: b for b in candidate_boards}
    profile_boards = [
        all_board_map[bid]
        for bid in (profile['followed_board_ids'] | profile['own_board_ids'])
        if bid in all_board_map
    ]

    now = datetime.utcnow()

    # ── Content-based ──────────────────────────────────────────────────────
    try:
        if cold_start or not profile_boards:
            content = np.zeros(len(candidates), dtype=np.float32)
        else:
            content = _board_content_scores(candidates, profile_boards)
    except Exception as e:
        logger.warning(f"[RecoEngine-Board] content error: {e}")
        content = np.zeros(len(candidates), dtype=np.float32)

    # ── Collaborative ──────────────────────────────────────────────────────
    try:
        collab = _board_collab_scores(candidates, current_user.id)
    except Exception as e:
        logger.warning(f"[RecoEngine-Board] collab error: {e}")
        collab = np.zeros(len(candidates), dtype=np.float32)

    # ── Emotional ──────────────────────────────────────────────────────────
    emotional = _board_emotional_scores(candidates, profile['mood_histogram'])

    # ── Freshness / Activity ───────────────────────────────────────────────
    freshness = np.array(
        [_board_freshness(b, now) for b in candidates],
        dtype=np.float32,
    )

    # ── Финальный score ────────────────────────────────────────────────────
    if cold_start:
        # Cold start: упор на popularity + freshness
        w = (0.0, 0.20, 0.30, 0.50)
    else:
        w = (ALPHA_B, BETA_B, GAMMA_B, DELTA_B)

    final = (
        w[0] * content   +
        w[1] * collab    +
        w[2] * emotional +
        w[3] * freshness
    )

    order = np.argsort(final)[::-1]
    return [candidates[i] for i in order]


# ─────────────────────────────────────────────────────────────────────────────
# Публичный API: трендовые доски
# ─────────────────────────────────────────────────────────────────────────────

def rank_boards_trending(candidate_boards: list) -> list:
    """
    Глобальный неперсонализированный ранкинг (правая колонка «В тренде»).

    Score = 0.40 * popularity + 0.35 * momentum + 0.25 * freshness

    popularity = нормированный followers_count
    momentum   = скорость роста подписчиков за 48ч
    freshness  = активность постов внутри доски
    """
    if not candidate_boards:
        return []

    now = datetime.utcnow()

    # Popularity
    max_f = max((b.followers_count for b in candidate_boards), default=1)
    max_f = max(max_f, 1)
    popularity = np.array(
        [b.followers_count / max_f for b in candidate_boards],
        dtype=np.float32,
    )

    # Momentum (скорость роста)
    try:
        momentum = _board_momentum(candidate_boards, now)
    except Exception as e:
        logger.warning(f"[RecoEngine-Board] momentum error: {e}")
        momentum = popularity.copy()

    # Freshness (активность: посты + дата создания)
    freshness = np.array(
        [_board_freshness(b, now) for b in candidate_boards],
        dtype=np.float32,
    )

    final = 0.40 * popularity + 0.35 * momentum + 0.25 * freshness

    order = np.argsort(final)[::-1]
    return [candidate_boards[i] for i in order]


# ─────────────────────────────────────────────────────────────────────────────
# Вызывается из boards.py при follow/create → сброс кеша
# ─────────────────────────────────────────────────────────────────────────────

def on_board_changed() -> None:
    """Инвалидирует кеш эмбеддингов досок."""
    _invalidate_board_cache()