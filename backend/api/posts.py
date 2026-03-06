"""
api/posts.py — роуты постов.

Сохранены все существующие эндпоинты (feed, create, get, delete).
Добавлены новые по ТЗ: PUT update, GET /me, POST /<id>/image.
post_to_dict расширен новыми полями (mood, visibility, tags, image_preview_url)
— обратная совместимость с boards.py и users.py сохранена.
"""
import os
import time
from typing import Optional

from flask import request, jsonify, g, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import BaseModel, field_validator, ValidationError

from . import api_bp
from models import db, Post, Board, Tag, MoodEnum, VisibilityEnum, post_tags
from utils import get_avatar_url, RecommendationEngine


# ── Pydantic-схемы ────────────────────────────────────────────────────────────

class CreatePostSchema(BaseModel):
    title:      Optional[str]           = None
    content:    str
    mood:       Optional[MoodEnum]      = None
    visibility: VisibilityEnum          = VisibilityEnum.public
    tags:       list[str]               = []
    board_id:   Optional[int]           = None
    # обратная совместимость со старым фронтом
    postType:   str                     = Post.TYPE_TEXT
    imageUrl:   Optional[str]           = None

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Текст поста не может быть пустым')
        if len(v) > 10_000:
            raise ValueError('Пост слишком длинный (максимум 10 000 символов)')
        return v

    @field_validator('tags')
    @classmethod
    def tags_valid(cls, v: list[str]) -> list[str]:
        if len(v) > 10:
            raise ValueError('Максимум 10 тегов')
        return [t.strip().lower() for t in v if t.strip()]


class UpdatePostSchema(BaseModel):
    title:      Optional[str]           = None
    content:    Optional[str]           = None
    mood:       Optional[MoodEnum]      = None
    visibility: Optional[VisibilityEnum]= None
    tags:       Optional[list[str]]     = None

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Текст поста не может быть пустым')
        return v


# ── Вспомогательные функции ───────────────────────────────────────────────────

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
    Сохранить оригинал + превью. Возвращает (image_url, preview_url) — пути
    относительно static/, пригодные для url_for('static', filename=...).
    """
    from PIL import Image
    ALLOWED = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED:
        return None, None

    timestamp = int(time.time())
    fname   = f'post_{post_id}_{timestamp}.{ext}'
    p_fname = f'post_{post_id}_{timestamp}_preview.{ext}'

    upload_dir = os.path.join(current_app.static_folder, 'uploads', 'posts')
    os.makedirs(upload_dir, exist_ok=True)

    orig_path    = os.path.join(upload_dir, fname)
    preview_path = os.path.join(upload_dir, p_fname)
    file.save(orig_path)

    # Превью 400×400
    preview_url = None
    try:
        img = Image.open(orig_path)
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        img.save(preview_path, quality=85, optimize=True)
        preview_url = f'uploads/posts/{p_fname}'
    except Exception:
        pass

    return f'uploads/posts/{fname}', preview_url


def _delete_file(relative_url: Optional[str]) -> None:
    if not relative_url:
        return
    try:
        path = os.path.join(current_app.static_folder, relative_url)
        if os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass


def post_to_dict(post: Post) -> dict:
    """
    Основной сериализатор. Расширен новыми полями (mood, visibility, tags,
    image_preview_url), но старые ключи сохранены — boards.py и users.py
    продолжают работать без изменений.
    """
    author = post.user

    content = {'type': post.post_type}
    if post.title:
        content['title'] = post.title
    if post.image_url:
        content['imageUrl'] = post.image_url
    if post.image_preview_url:
        content['imagePreviewUrl'] = post.image_preview_url
    if post.content:
        if post.post_type == Post.TYPE_TEXT:
            content['text'] = post.content
        else:
            content['caption'] = post.content

    source_board = None
    if post.board_id and post.board:
        source_board = {'id': str(post.board_id), 'name': post.board.name}

    return {
        # ── старые поля (не меняем) ───────────────────────────────────
        'id':          str(post.id),
        'author': {
            'id':       str(author.id),
            'name':     author.username,
            'username': f'@{author.username}',
            'avatar':   get_avatar_url(author),
        },
        'sourceBoard': source_board,
        'content':     content,
        'engagement':  {'reactions': 0, 'comments': 0, 'saves': 0},
        'timestamp':   post.created_at.strftime('%d.%m.%Y %H:%M'),
        # ── новые поля (ТЗ) ───────────────────────────────────────────
        'mood':        post.mood.value if post.mood else None,
        'visibility':  post.visibility.value if post.visibility else 'public',
        'tags':        [t.name for t in post.tags],
        'updated_at':  post.updated_at.isoformat() if post.updated_at else None,
    }


# ── Существующие эндпоинты (не трогаем логику, только дополняем) ─────────────

@api_bp.route('/posts/feed', methods=['GET'])
def feed():
    page    = request.args.get('page', 1, type=int)
    per_page = current_app.config.get('POSTS_PER_PAGE', 20)

    if g.current_user:
        followed_ids = [u.id for u in g.current_user.following]
        followed_ids.append(g.current_user.id)
        all_posts = Post.query.filter(
            Post.user_id.in_(followed_ids)
        ).order_by(Post.created_at.desc()).all()
        mode  = request.args.get('mode', 'balanced')
        posts = RecommendationEngine.get_recommended_posts(g.current_user, all_posts, mode)
    else:
        posts = Post.query.order_by(Post.created_at.desc()).limit(per_page * page).all()

    start      = (page - 1) * per_page
    page_posts = posts[start:start + per_page]

    return jsonify({
        'posts':    [post_to_dict(p) for p in page_posts],
        'page':     page,
        'has_more': len(posts) > start + per_page,
    })


@api_bp.route('/posts', methods=['POST'])
def create_post():
    """
    Создать пост. Принимает JSON с новыми полями (mood, visibility, tags)
    И старый формат (postType, imageUrl, boardId) — оба работают.
    Требует JWT-токен (Authorization: Bearer <token>).
    """
    # Поддержка обоих способов авторизации: JWT и сессия
    current_user = _get_current_user()
    if not current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    try:
        body = CreatePostSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({'errors': e.errors()}), 422

    board = None
    if body.board_id:
        board = db.session.get(Board, body.board_id)
        if not board:
            return jsonify({'error': 'Доска не найдена'}), 404

    post = Post(
        post_type  = body.postType,
        content    = body.content.strip(),
        title      = body.title,
        image_url  = body.imageUrl,
        mood       = body.mood,
        visibility = body.visibility,
        user_id    = current_user.id,
        board_id   = board.id if board else None,
    )
    post.tags = _resolve_tags(body.tags)

    current_user.posts_count += 1
    if board:
        board.post_count += 1

    db.session.add(post)
    db.session.commit()
    return jsonify(post_to_dict(post)), 201


@api_bp.route('/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({'error': 'Пост не найден'}), 404
    return jsonify(post_to_dict(post))


@api_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({'error': 'Пост не найден'}), 404
    if post.user_id != current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    current_user.posts_count = max(0, current_user.posts_count - 1)
    if post.board_id and post.board:
        post.board.post_count = max(0, post.board.post_count - 1)

    # Удалить файлы
    _delete_file(post.image_url)
    _delete_file(post.image_preview_url)

    db.session.delete(post)
    db.session.commit()
    return jsonify({'ok': True})


# ── Новые эндпоинты по ТЗ ────────────────────────────────────────────────────

@api_bp.route('/posts/me', methods=['GET'])
@jwt_required()
def my_posts():
    """Список постов текущего пользователя (только с JWT)."""
    user_id = int(get_jwt_identity())
    posts   = Post.query.filter_by(user_id=user_id)\
                        .order_by(Post.created_at.desc()).all()
    return jsonify([post_to_dict(p) for p in posts]), 200


@api_bp.route('/posts/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    """Обновить пост — только владелец."""
    user_id = int(get_jwt_identity())

    try:
        body = UpdatePostSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({'errors': e.errors()}), 422

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({'error': 'Пост не найден'}), 404
    if post.user_id != user_id:
        return jsonify({'error': 'Нет доступа'}), 403

    if body.title      is not None: post.title      = body.title
    if body.content    is not None: post.content    = body.content
    if body.mood       is not None: post.mood       = body.mood
    if body.visibility is not None: post.visibility = body.visibility
    if body.tags       is not None: post.tags       = _resolve_tags(
        [t.strip().lower() for t in body.tags if t.strip()]
    )

    db.session.commit()
    return jsonify(post_to_dict(post)), 200


@api_bp.route('/posts/<int:post_id>/image', methods=['POST'])
@jwt_required()
def upload_post_image(post_id):
    """Загрузить / сменить изображение поста — только владелец."""
    user_id = int(get_jwt_identity())

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({'error': 'Пост не найден'}), 404
    if post.user_id != user_id:
        return jsonify({'error': 'Нет доступа'}), 403

    if 'image' not in request.files:
        return jsonify({'error': 'Поле image обязательно'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'Пустое имя файла'}), 400

    # Проверка размера (≤ 5 MB) до обработки
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > 5 * 1024 * 1024:
        return jsonify({'error': 'Изображение превышает 5 MB'}), 413

    # Удалить старые файлы
    _delete_file(post.image_url)
    _delete_file(post.image_preview_url)

    image_url, preview_url = _save_post_image(file, post_id)
    if not image_url:
        return jsonify({'error': 'Недопустимый формат. Разрешены: png, jpg, jpeg, gif, webp'}), 400

    post.image_url         = image_url
    post.image_preview_url = preview_url
    post.post_type = Post.TYPE_MIXED if post.content else Post.TYPE_IMAGE

    db.session.commit()
    return jsonify(post_to_dict(post)), 200


# ── Утилита: получить пользователя из JWT или сессии ─────────────────────────

def _get_current_user():
    """
    Пробуем JWT сначала, затем — сессионный g.current_user.
    Это позволяет старому фронту (сессии) и новому (JWT) работать одновременно.
    """
    from flask_jwt_extended import verify_jwt_in_request
    try:
        verify_jwt_in_request(optional=True)
        from flask_jwt_extended import get_jwt_identity
        identity = get_jwt_identity()
        if identity:
            return db.session.get(
                __import__('models', fromlist=['User']).User,
                int(identity)
            )
    except Exception:
        pass
    return g.current_user