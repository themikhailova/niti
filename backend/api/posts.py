"""
api/posts.py — роуты постов.

Эндпоинты:
  POST   /api/posts/              Создать пост
  GET    /api/posts/feed          Лента (JWT или сессия, или гость)
  GET    /api/posts/me            Мои посты (JWT обязателен)
  GET    /api/posts/<id>          Получить один пост (без авторизации)
  PUT    /api/posts/<id>          Обновить пост (JWT, только владелец)
  DELETE /api/posts/<id>          Удалить пост  (JWT, только владелец)
  POST   /api/posts/<id>/image    Загрузить/сменить изображение (JWT, только владелец)
"""

import os
import time
from datetime import datetime
from typing import Optional

from flask import current_app, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from models import Board, MoodEnum, Post, Tag, User, VisibilityEnum, db
from pydantic import BaseModel, ValidationError, field_validator
from services.recommendation_engine import on_post_created, score_and_rank
from sqlalchemy import or_
from utils import get_avatar_url

from . import api_bp

# ── Pydantic-схемы ────────────────────────────────────────────────────────────


class CreatePostSchema(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood: Optional[str] = None  # валидируем вручную → 400, не 422
    visibility: str = "public"  # 'public' | 'private'
    tags: list[str] = []
    board_id: Optional[int] = None
    postType: str = Post.TYPE_TEXT
    imageUrl: Optional[str] = None  # прямая ссылка (редко используется)

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Текст поста не может быть пустым")
        if len(v) > 10_000:
            raise ValueError("Пост слишком длинный (максимум 10 000 символов)")
        return v

    @field_validator("tags")
    @classmethod
    def tags_valid(cls, v: list[str]) -> list[str]:
        if len(v) > 10:
            raise ValueError("Максимум 10 тегов")
        return [t.strip().lower() for t in v if t.strip()]

    @field_validator("visibility")
    @classmethod
    def visibility_valid(cls, v: str) -> str:
        if v not in ("public", "private"):
            raise ValueError("visibility должен быть 'public' или 'private'")
        return v

    def get_mood(self) -> Optional[MoodEnum]:
        """Вернуть MoodEnum или None. ValueError при неверном значении."""
        if not self.mood:
            return None
        try:
            return MoodEnum(self.mood)
        except ValueError:
            valid = ", ".join(m.value for m in MoodEnum)
            raise ValueError(f"Неверный mood. Допустимые значения: {valid}")

    def get_visibility(self) -> VisibilityEnum:
        return VisibilityEnum(self.visibility)


class UpdatePostSchema(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood: Optional[str] = None
    visibility: Optional[str] = None
    tags: Optional[list[str]] = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Текст поста не может быть пустым")
        return v

    @field_validator("visibility")
    @classmethod
    def visibility_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("public", "private"):
            raise ValueError("visibility должен быть 'public' или 'private'")
        return v

    def get_mood(self) -> Optional[MoodEnum]:
        if not self.mood:
            return None
        try:
            return MoodEnum(self.mood)
        except ValueError:
            valid = ", ".join(m.value for m in MoodEnum)
            raise ValueError(f"Неверный mood. Допустимые значения: {valid}")

    def get_visibility(self) -> Optional[VisibilityEnum]:
        return VisibilityEnum(self.visibility) if self.visibility else None


# ── Вспомогательные функции ───────────────────────────────────────────────────


def _pydantic_errors(e: ValidationError) -> list[dict]:
    return [
        {"field": ".".join(str(loc) for loc in err["loc"]), "message": str(err["msg"])}
        for err in e.errors()
    ]


def _resolve_tags(names: list[str]) -> list[Tag]:
    """Найти существующие или создать новые теги по именам."""
    result = []
    for name in names:
        tag = Tag.query.filter_by(name=name).first()
        if not tag:
            tag = Tag(name=name)
            db.session.add(tag)
        result.append(tag)
    return result


def _save_post_image(file, post_id: int) -> tuple[Optional[str], Optional[str]]:
    """
    Сохранить оригинал + превью.
    Возвращает (relative_url, preview_relative_url) — пути относительно static/.
    При ошибке формата возвращает (None, None).
    """
    from PIL import Image

    ALLOWED = {"png", "jpg", "jpeg", "gif", "webp"}
    if "." not in (file.filename or ""):
        return None, None
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        return None, None

    timestamp = int(time.time())
    fname = f"post_{post_id}_{timestamp}.{ext}"
    p_fname = f"post_{post_id}_{timestamp}_preview.{ext}"

    upload_dir = os.path.join(current_app.static_folder, "uploads", "posts")
    os.makedirs(upload_dir, exist_ok=True)

    orig_path = os.path.join(upload_dir, fname)
    preview_path = os.path.join(upload_dir, p_fname)

    file.save(orig_path)

    # Превью 400×400 без exif
    preview_url: Optional[str] = None
    try:
        img = Image.open(orig_path)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        # Убираем exif
        clean = Image.new(img.mode, img.size)
        clean.putdata(list(img.getdata()))
        clean.thumbnail((400, 400), Image.Resampling.LANCZOS)
        clean.save(preview_path, quality=85, optimize=True)
        preview_url = f"uploads/posts/{p_fname}"
    except Exception as exc:
        current_app.logger.warning(f"preview generation failed: {exc}")

    return f"uploads/posts/{fname}", preview_url


def _delete_file(relative_url: Optional[str]) -> None:
    """Удалить файл по относительному пути от static/."""
    if not relative_url:
        return
    try:
        path = os.path.join(current_app.static_folder, relative_url)
        if os.path.isfile(path):
            os.remove(path)
    except OSError as exc:
        current_app.logger.warning(f"file delete failed ({relative_url}): {exc}")


def _engagement(post) -> dict:
    """Реальные счётчики engagement из БД."""
    return {
        "reactions": post.reactions.count(),
        "comments":  post.comments.count(),
        # Считаем число сохранений: сколько пользователей сохранило этот пост
        # Для обычного поста — ищем saved-копии с original_post_id = post.id
        # Для самой saved-копии — ищем по её original_post_id
        "saves": Post.query.filter_by(
            original_post_id=post.original_post_id if post.post_kind == "saved" else post.id,
            post_kind="saved",
        ).count() if (post.post_kind == "saved" or post.id) else 0,
    }


def post_to_dict(post: Post, viewer_id: Optional[int] = None) -> dict:
    """
    Основной сериализатор поста.

    viewer_id — id текущего пользователя (для is_own).
    Старые поля сохранены для совместимости с boards.py и users.py.
    """
    author = post.user

    # nested content object (совместимость с post-card.tsx)
    content: dict = {"type": post.post_type}
    if post.title:
        content["title"] = post.title
    if post.image_url:
        content["imageUrl"] = f"/static/{post.image_url}"
    if post.image_preview_url:
        content["imagePreviewUrl"] = f"/static/{post.image_preview_url}"
    if post.content:
        if post.post_type == Post.TYPE_TEXT:
            content["text"] = post.content
        else:
            content["caption"] = post.content

    source_board = None
    if post.board_id and post.board:
        source_board = {"id": str(post.board_id), "name": post.board.name}

    return {
        # ── идентификация ──────────────────────────────────────────────────
        "id": str(post.id),
        "postType": post.post_type,
        # ── контент ────────────────────────────────────────────────────────
        "content": content,
        "mood": post.mood.value if post.mood else None,
        "visibility": post.visibility.value if post.visibility else "public",
        # ── автор ──────────────────────────────────────────────────────────
        "author": {
            "id": str(author.id),
            "username": f"@{author.username}",
            "avatar": get_avatar_url(author),
        },
        # ── ownership ──────────────────────────────────────────────────────
        "is_own": viewer_id == post.user_id if viewer_id else False,
        # Сохранил ли текущий пользователь этот пост
        "is_saved": Post.query.filter_by(
            user_id=viewer_id,
            original_post_id=post.id,
            post_kind="saved",
        ).first() is not None if viewer_id and post.post_kind != "saved" else (
            post.post_kind == "saved" and post.user_id == viewer_id if viewer_id else False
        ),
        # ── engagement (живые счётчики) ────────────────────────────────────
        "engagement": _engagement(post),
        # ── доска ──────────────────────────────────────────────────────────
        "sourceBoard": source_board,
        # ── теги ───────────────────────────────────────────────────────────
        "tags": [tag.name for tag in post.tags],
        # ── репост / сохранение ──────────────────────────────────────────
        "post_kind": post.post_kind,
        "original_post_id": str(post.original_post_id)
        if post.original_post_id
        else None,
        # ── временные метки ────────────────────────────────────────────────
        "createdAt": post.created_at.isoformat() if post.created_at else None,
        "updatedAt": post.updated_at.isoformat() if post.updated_at else None,
    }


def _get_current_user() -> Optional[User]:
    """Получить текущего пользователя из JWT или g.current_user (сессия)."""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            return db.session.get(User, int(identity))
    except Exception:
        pass
    return g.get("current_user")


# ── Эндпоинты ─────────────────────────────────────────────────────────────────


@api_bp.route('/posts/feed', methods=['GET'])
def feed():
    """
    GET /api/posts/feed?page=1&mood=calm
    Простая и надёжная лента.
    """
    page = request.args.get('page', 1, type=int)
    per_page = current_app.config.get('POSTS_PER_PAGE', 20)
    requested_mood = request.args.get('mood')  # например: joyful, calm и т.д.

    # Валидация mood
    valid_moods = {m.value for m in MoodEnum}
    if requested_mood and requested_mood not in valid_moods:
        return jsonify({'error': f'Неверный mood. Допустимые: {", ".join(sorted(valid_moods))}'}), 400

    current_user = _get_current_user()
    viewer_id = current_user.id if current_user else None

    # Базовый запрос
    query = Post.query

    if current_user:
        # Показываем посты тех, на кого подписан + свои + все публичные
        followed_ids = [u.id for u in current_user.following.all()]
        followed_ids.append(current_user.id)
        query = query.filter(
            or_(
                Post.user_id.in_(followed_ids),
                Post.visibility == VisibilityEnum.public,
            )
        )
    else:
        # Для гостей — только публичные посты
        query = query.filter(Post.visibility == VisibilityEnum.public)

    # Фильтр по настроению (если передан)
    if requested_mood:
        try:
            mood_enum = MoodEnum(requested_mood)
            query = query.filter(Post.mood == mood_enum)
        except ValueError:
            pass

    # Сортировка по новизне
    query = query.order_by(Post.created_at.desc())

    # Пагинация
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'posts': [post_to_dict(p, viewer_id) for p in pagination.items],
        'page': page,
        'has_more': pagination.has_next,
        'total': pagination.total,
        'algo': 'chronological',
    })


@api_bp.route("/posts/", methods=["POST"])
def create_post():
    """
    POST /api/posts/
    Создать пост. Принимает JWT или сессию.
    """
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "Требуется авторизация"}), 401

    try:
        body = CreatePostSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({"error": errs[0]["message"], "errors": errs}), 422

    # mood валидируется отдельно → 400 (по ТЗ, не 422)
    try:
        mood = body.get_mood()
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    # Валидация контента
    post_type = body.postType
    valid, err = Post.validate_content(body.content, post_type, body.imageUrl)
    if not valid:
        # image/mixed без контента — разрешаем (изображение придёт отдельным запросом)
        if post_type == Post.TYPE_TEXT and not body.content:
            return jsonify({"error": "Для текстового поста необходим текст"}), 422

    # Доска
    board: Optional[Board] = None
    if body.board_id:
        board = db.session.get(Board, body.board_id)
        if not board:
            return jsonify({"error": "Доска не найдена"}), 404

    post = Post(
        post_type=post_type,
        content=body.content.strip() if body.content else None,
        title=body.title.strip() if body.title else None,
        image_url=body.imageUrl,
        mood=mood,
        visibility=body.get_visibility(),
        user_id=current_user.id,
        board_id=board.id if board else None,
    )
    post.tags = _resolve_tags(body.tags)

    # Денормализованные счётчики
    current_user.posts_count = (current_user.posts_count or 0) + 1
    if board:
        board.post_count = (board.post_count or 0) + 1

    db.session.add(post)
    db.session.commit()

    try:
        on_post_created()
    except Exception:
        pass

    return jsonify(post_to_dict(post, current_user.id)), 201


@api_bp.route("/posts/me", methods=["GET"])
@jwt_required()
def my_posts():
    """
    GET /api/posts/me
    Список постов текущего пользователя. JWT обязателен.
    """
    user_id = int(get_jwt_identity())
    posts = Post.query.filter_by(user_id=user_id).order_by(Post.created_at.desc()).all()
    return jsonify([post_to_dict(p, user_id) for p in posts]), 200


@api_bp.route("/posts/saved", methods=["GET"])
@jwt_required()
def my_saved_posts():
    """
    GET /api/posts/saved?page=1&per_page=20
    Список постов сохранённых текущим пользователем.
    Возвращает оригинальные посты (не saved-копии), отсортированные по дате сохранения.
    """
    user_id  = int(get_jwt_identity())
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    # Берём saved-записи пользователя — это копии постов с post_kind="saved"
    saved_records = (
        Post.query
        .filter_by(user_id=user_id, post_kind="saved")
        .order_by(Post.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    total = Post.query.filter_by(user_id=user_id, post_kind="saved").count()

    # Для каждой saved-записи берём оригинальный пост и сериализуем его
    result = []
    for saved_rec in saved_records:
        original = db.session.get(Post, saved_rec.original_post_id)
        if not original:
            continue
        d = post_to_dict(original, user_id)
        d["is_saved"]   = True
        d["saved_at"]   = saved_rec.created_at.isoformat() if saved_rec.created_at else None
        d["post_kind"]  = "saved"   # чтобы ProfilePage мог фильтровать
        result.append(d)

    return jsonify({
        "posts":    result,
        "page":     page,
        "per_page": per_page,
        "total":    total,
        "has_more": total > page * per_page,
    }), 200


@api_bp.route("/posts/<int:post_id>", methods=["GET"])
def get_post(post_id: int):
    """
    GET /api/posts/<id>
    Получить один пост. Авторизация не требуется.
    """
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Пост не найден"}), 404

    current_user = _get_current_user()
    viewer_id = current_user.id if current_user else None

    return jsonify(post_to_dict(post, viewer_id)), 200


@api_bp.route("/posts/<int:post_id>", methods=["PUT"])
@jwt_required()
def update_post(post_id: int):
    """
    PUT /api/posts/<id>
    Обновить пост. JWT обязателен. Только владелец.
    """
    user_id = int(get_jwt_identity())

    try:
        body = UpdatePostSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({"error": errs[0]["message"], "errors": errs}), 422

    try:
        mood = body.get_mood()
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Пост не найден"}), 404
    if post.user_id != user_id:
        return jsonify({"error": "Нет доступа"}), 403

    if body.title is not None:
        post.title = body.title.strip()
    if body.content is not None:
        post.content = body.content.strip()
    if mood is not None:
        post.mood = mood
    if body.visibility is not None:
        post.visibility = body.get_visibility()
    if body.tags is not None:
        cleaned = [t.strip().lower() for t in body.tags if t.strip()]
        post.tags = _resolve_tags(cleaned)

    post.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(post_to_dict(post, user_id)), 200


@api_bp.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id: int):
    """
    DELETE /api/posts/<id>
    Удалить пост. JWT или сессия. Только владелец.
    """
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "Требуется авторизация"}), 401

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Пост не найден"}), 404
    if post.user_id != current_user.id:
        return jsonify({"error": "Нет доступа"}), 403

    # Денормализованные счётчики
    current_user.posts_count = max(0, (current_user.posts_count or 1) - 1)
    if post.board_id and post.board:
        post.board.post_count = max(0, (post.board.post_count or 1) - 1)

    # Удалить файлы изображений
    _delete_file(post.image_url)
    _delete_file(post.image_preview_url)

    db.session.delete(post)
    db.session.commit()

    return jsonify({"ok": True}), 200


@api_bp.route("/posts/<int:post_id>/image", methods=["POST"])
@jwt_required()
def upload_post_image(post_id: int):
    """
    POST /api/posts/<id>/image
    Загрузить или сменить изображение поста. JWT обязателен. Только владелец.
    Максимальный размер файла: 5 МБ (обрабатывается Flask MAX_CONTENT_LENGTH,
    но здесь добавлена ручная проверка для читаемого сообщения об ошибке).
    """
    user_id = int(get_jwt_identity())

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Пост не найден"}), 404
    if post.user_id != user_id:
        return jsonify({"error": "Нет доступа"}), 403

    if "image" not in request.files:
        return jsonify({"error": "Поле image обязательно"}), 400

    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"error": "Пустое имя файла"}), 400

    # Проверка размера (≤ 5 МБ)
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > 5 * 1024 * 1024:
        return jsonify({"error": "Изображение превышает 5 МБ"}), 413

    # Удалить старые файлы перед сохранением новых
    _delete_file(post.image_url)
    _delete_file(post.image_preview_url)

    image_url, preview_url = _save_post_image(file, post_id)
    if not image_url:
        return jsonify(
            {"error": "Недопустимый формат. Разрешены: png, jpg, jpeg, gif, webp"}
        ), 400

    post.image_url = image_url
    post.image_preview_url = preview_url
    # Уточняем тип поста
    post.post_type = Post.TYPE_MIXED if post.content else Post.TYPE_IMAGE
    post.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify(post_to_dict(post, user_id)), 200


# ── Репосты и сохранения ──────────────────────────────────────────────────────

@api_bp.route("/posts/<int:post_id>/repost", methods=["POST"])
def repost_post(post_id: int):
    """
    POST /api/posts/<id>/repost
    Репостит чужой публичный пост.
    """
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "Требуется авторизация"}), 401

    original = db.session.get(Post, post_id)
    if not original:
        return jsonify({"error": "Пост не найден"}), 404
    if original.user_id == current_user.id:
        return jsonify({"error": "Нельзя репостить свои посты"}), 400
    if original.visibility and original.visibility.value == "private":
        return jsonify({"error": "Нельзя репостить приватный пост"}), 403

    # Создаём новый пост-репост
    repost = Post(
        post_type=original.post_type,
        content=original.content,
        title=original.title,
        image_url=original.image_url,
        image_preview_url=original.image_preview_url,
        mood=original.mood,
        visibility=VisibilityEnum.public,        # ← ИСПРАВЛЕНО: public (маленькими буквами)
        user_id=current_user.id,
        board_id=None,
        post_kind="repost",
        original_post_id=original.id,
    )
    repost.tags = list(original.tags)
    current_user.posts_count = (current_user.posts_count or 0) + 1
    db.session.add(repost)
    db.session.commit()

    return jsonify(post_to_dict(repost, current_user.id)), 201

@api_bp.route("/posts/<int:post_id>/save", methods=["POST"])
def save_post(post_id: int):
    """
    POST /api/posts/<id>/save
    Сохраняет или убирает из сохранённых пост текущего пользователя.
    """
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "Требуется авторизация"}), 401

    original = db.session.get(Post, post_id)
    if not original:
        return jsonify({"error": "Пост не найден"}), 404
    if original.visibility and original.visibility.value == "private":
        return jsonify({"error": "Нельзя сохранять приватный пост"}), 403

    # Проверяем, есть ли уже сохранённая копия
    existing_save = Post.query.filter_by(
        user_id=current_user.id, 
        original_post_id=original.id, 
        post_kind="saved"
    ).first()

    if existing_save:
        # Убираем из сохранённых
        db.session.delete(existing_save)
        current_user.posts_count = max(0, (current_user.posts_count or 1) - 1)
        db.session.commit()
        saves_count = Post.query.filter_by(
            original_post_id=original.id, post_kind="saved"
        ).count()
        return jsonify({"saved": False, "saves_count": saves_count}), 200
    else:
        # Сохраняем
        saved_post = Post(
            post_type=original.post_type,
            content=original.content,
            title=original.title,
            image_url=original.image_url,
            image_preview_url=original.image_preview_url,
            mood=original.mood,
            visibility=VisibilityEnum.private,   # ← ИСПРАВЛЕНО: private (маленькими буквами)
            user_id=current_user.id,
            board_id=None,
            post_kind="saved",
            original_post_id=original.id,
        )
        saved_post.tags = list(original.tags)
        current_user.posts_count = (current_user.posts_count or 0) + 1
        db.session.add(saved_post)
        db.session.commit()

        saves_count = Post.query.filter_by(
            original_post_id=original.id, post_kind="saved"
        ).count()
        return jsonify({"saved": True, "saves_count": saves_count}), 201