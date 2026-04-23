"""
api/boards.py — CRUD досок.

Эндпоинты:
  POST   /api/boards/              — создать доску (JWT)
  GET    /api/boards/<id>          — получить одну доску (публично)
  GET    /api/boards/me            — мои доски (JWT)
  GET    /api/users/<id>/boards    — публичные доски пользователя
  PUT    /api/boards/<id>          — обновить доску (JWT, только владелец)
  DELETE /api/boards/<id>          — удалить доску (JWT, только владелец)
"""
from typing import Optional

from flask import request, jsonify, g
from flask_jwt_extended import (
    verify_jwt_in_request, get_jwt_identity, jwt_required,
)
from pydantic import BaseModel, field_validator, ValidationError

from . import api_bp
from models import db, Board, Post, User
from utils import get_avatar_url
from services.recommendation_engine import (
    rank_boards_personalized, rank_boards_trending, on_board_changed
)


# ── Вспомогательные функции ───────────────────────────────────────────────────

def _get_current_user() -> Optional[User]:
    """JWT или сессия — оба работают."""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            return db.session.get(User, int(identity))
    except Exception:
        pass
    return g.current_user


def _pydantic_errors(e: ValidationError) -> list[dict]:
    return [
        {'field': '.'.join(str(loc) for loc in err['loc']), 'message': err['msg']}
        for err in e.errors()
    ]


def board_to_dict(board: Board, current_user: Optional[User] = None) -> dict:
    is_following = (
        current_user.is_following_board(board)
        if current_user else False
    )
    return {
        'id':           str(board.id),
        'name':         board.name,
        'description':  board.description or '',
        'coverImage': board.cover_image or None,
        'tags':         board.tags or [],
        'isPublic':     board.is_public,
        'followers':    board.followers_count,
        'postCount':    board.post_count,
        'collaborators': board.collaborators_count,
        'isFollowing':  is_following,
        'createdAt':    board.created_at.isoformat() if board.created_at else None,
        'creator': {
            'id':       str(board.creator_id),
            'username': f'@{board.creator.username}',
            'avatar':   get_avatar_url(board.creator),
        },
    }


# ── Pydantic-схемы ────────────────────────────────────────────────────────────

class CreateBoardSchema(BaseModel):
    name:        str
    description: str            = ''
    tags:        list[str]      = []
    isPublic:    bool           = True
    coverImage:  Optional[str]  = None
    post_ids: list[int] = [] 

    @field_validator('name')
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Название доски не может быть пустым')
        if len(v) > 100:
            raise ValueError('Название слишком длинное (максимум 100 символов)')
        return v

    @field_validator('tags')
    @classmethod
    def tags_valid(cls, v: list[str]) -> list[str]:
        if len(v) > 10:
            raise ValueError('Максимум 10 тегов')
        return [t.strip().lower() for t in v if t.strip()]


class UpdateBoardSchema(BaseModel):
    name:        Optional[str]       = None
    description: Optional[str]       = None
    tags:        Optional[list[str]]  = None
    isPublic:    Optional[bool]       = None
    coverImage:  Optional[str]        = None
    post_ids:    Optional[list[int]]  = None  # None = не трогать, [] = очистить

    @field_validator('name')
    @classmethod
    def name_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError('Название доски не может быть пустым')
            if len(v) > 100:
                raise ValueError('Название слишком длинное (максимум 100 символов)')
        return v


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@api_bp.route('/boards/', methods=['POST'])
def create_board():
    """POST /api/boards/ — создать доску. JWT обязателен."""
    current_user = _get_current_user()
    if not current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    try:
        body = CreateBoardSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({'error': errs[0]['message'], 'errors': errs}), 422

    # 400 — доска с таким именем уже есть у этого пользователя
    exists = Board.query.filter_by(
        creator_id=current_user.id, name=body.name
    ).first()
    if exists:
        return jsonify({'error': 'Доска с таким названием уже существует'}), 400

    board = Board(
        name        = body.name,
        description = body.description.strip(),
        tags        = body.tags,
        cover_image = body.coverImage,
        is_public   = body.isPublic,
        creator_id  = current_user.id,
    )
    db.session.add(board)
    db.session.flush()  # чтобы получить board.id

    # ДОБАВЛЯЕМ ПОСТЫ
    if body.post_ids:
        Post.query.filter(
            Post.id.in_(body.post_ids),
            Post.user_id == current_user.id
        ).update({'board_id': board.id}, synchronize_session=False)

    db.session.commit()
    return jsonify(board_to_dict(board, current_user)), 201

@api_bp.route('/boards/<int:board_id>/posts', methods=['POST'])
@jwt_required()
def add_post_to_board(board_id: int):
    user_id = int(get_jwt_identity())
    data = request.get_json()

    post_id = data.get('post_id')
    if not post_id:
        return jsonify({'error': 'post_id обязателен'}), 400

    board = db.session.get(Board, board_id)
    post = db.session.get(Post, post_id)

    if not board or not post:
        return jsonify({'error': 'Не найдено'}), 404

    if board.creator_id != user_id:
        return jsonify({'error': 'Нет доступа'}), 403

    post.board_id = board.id
    db.session.commit()

    return jsonify({'ok': True})

@api_bp.route('/boards/<int:board_id>/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def remove_post_from_board(board_id: int, post_id: int):
    user_id = int(get_jwt_identity())

    board = db.session.get(Board, board_id)
    post = db.session.get(Post, post_id)

    if not board or not post:
        return jsonify({'error': 'Не найдено'}), 404

    if board.creator_id != user_id:
        return jsonify({'error': 'Нет доступа'}), 403

    if post.board_id == board.id:
        post.board_id = None
        db.session.commit()

    return jsonify({'ok': True})

@api_bp.route('/boards/me', methods=['GET'])
@jwt_required()
def my_boards():
    """GET /api/boards/me — мои доски. JWT обязателен."""
    user_id = int(get_jwt_identity())
    boards  = Board.query.filter_by(creator_id=user_id)\
                         .order_by(Board.created_at.desc()).all()
    current_user = db.session.get(User, user_id)
    return jsonify([board_to_dict(b, current_user) for b in boards]), 200


@api_bp.route('/boards/<int:board_id>', methods=['GET'])
def get_board(board_id: int):
    """GET /api/boards/<id> — публичный просмотр доски."""
    board = db.session.get(Board, board_id)
    if not board:
        return jsonify({'error': 'Доска не найдена'}), 404
    current_user = _get_current_user()
    return jsonify(board_to_dict(board, current_user)), 200


@api_bp.route('/boards/<int:board_id>', methods=['PUT'])
@jwt_required()
def update_board(board_id: int):
    """PUT /api/boards/<id> — обновить доску. Только владелец."""
    user_id = int(get_jwt_identity())

    try:
        body = UpdateBoardSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({'error': errs[0]['message'], 'errors': errs}), 422

    board = db.session.get(Board, board_id)
    if not board:
        return jsonify({'error': 'Доска не найдена'}), 404
    if board.creator_id != user_id:
        return jsonify({'error': 'Нет доступа'}), 403

    # 400 — новое название уже занято другой доской этого пользователя
    if body.name is not None and body.name != board.name:
        exists = Board.query.filter_by(
            creator_id=user_id, name=body.name
        ).first()
        if exists:
            return jsonify({'error': 'Доска с таким названием уже существует'}), 400

    if body.name        is not None: board.name        = body.name
    if body.description is not None: board.description = body.description.strip()
    if body.tags        is not None: board.tags        = body.tags
    if body.isPublic    is not None: board.is_public   = body.isPublic
    if body.coverImage  is not None: board.cover_image = body.coverImage

    # Обновляем список постов доски если передан post_ids
    if body.post_ids is not None:
        # Отвязываем все текущие посты этого пользователя от доски
        Post.query.filter_by(board_id=board.id, user_id=user_id).update(
            {'board_id': None}, synchronize_session=False
        )
        # Привязываем выбранные посты (только свои)
        if body.post_ids:
            Post.query.filter(
                Post.id.in_(body.post_ids),
                Post.user_id == user_id
            ).update({'board_id': board.id}, synchronize_session=False)

    db.session.commit()
    current_user = db.session.get(User, user_id)
    return jsonify(board_to_dict(board, current_user)), 200


@api_bp.route('/boards/<int:board_id>', methods=['DELETE'])
@jwt_required()
def delete_board(board_id: int):
    """
    DELETE /api/boards/<id> — удалить доску. Только владелец.
    Если есть посты — разрываем связь (post.board_id = NULL), доска удаляется.
    """
    user_id = int(get_jwt_identity())

    board = db.session.get(Board, board_id)
    if not board:
        return jsonify({'error': 'Доска не найдена'}), 404
    if board.creator_id != user_id:
        return jsonify({'error': 'Нет доступа'}), 403

    post_count = board.posts.count()
    if post_count > 0:
        # Мягкое удаление: разрываем связь постов с доской
        Post.query.filter_by(board_id=board_id).update({'board_id': None})

    db.session.delete(board)
    db.session.commit()
    return jsonify({'ok': True, 'unlinked_posts': post_count}), 200


# ── Публичные доски другого пользователя ─────────────────────────────────────

@api_bp.route('/users/<int:user_id>/boards', methods=['GET'])
def get_user_boards_by_id(user_id: int):
    """GET /api/users/<user_id>/boards — публичные доски пользователя."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    current_user = _get_current_user()

    # Владелец видит все свои доски, остальные — только публичные
    if current_user and current_user.id == user_id:
        boards = Board.query.filter_by(creator_id=user_id)\
                            .order_by(Board.created_at.desc()).all()
    else:
        boards = Board.query.filter_by(creator_id=user_id, is_public=True)\
                            .order_by(Board.created_at.desc()).all()

    return jsonify({'boards': [board_to_dict(b, current_user) for b in boards]}), 200


# ── Старый эндпоинт по username (обратная совместимость) ─────────────────────

@api_bp.route('/users/<username>/boards', methods=['GET'])
def get_user_boards_by_username(username: str):
    """GET /api/users/<username>/boards — публичные доски по username."""
    # Если username — число, это user_id → редиректим логику
    if username.isdigit():
        return get_user_boards_by_id(int(username))

    user = User.query.filter_by(username=username).first_or_404()
    current_user = _get_current_user()

    if current_user and current_user.id == user.id:
        boards = user.boards.order_by(Board.created_at.desc()).all()
    else:
        boards = Board.query.filter_by(creator_id=user.id, is_public=True)\
                            .order_by(Board.created_at.desc()).all()

    return jsonify({'boards': [board_to_dict(b, current_user) for b in boards]}), 200


# ── Follow / Unfollow ─────────────────────────────────────────────────────────

@api_bp.route('/boards/<int:board_id>/follow', methods=['POST'])
def follow_board(board_id: int):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401
    board = db.session.get(Board, board_id)
    if not board:
        return jsonify({'error': 'Доска не найдена'}), 404
    current_user.follow_board(board)
    db.session.commit()
    try:
        on_board_changed()
    except Exception:
        pass
    return jsonify({'ok': True, 'followers': board.followers_count, 'isFollowing': True}), 200


@api_bp.route('/boards/<int:board_id>/unfollow', methods=['POST'])
def unfollow_board(board_id: int):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401
    board = db.session.get(Board, board_id)
    if not board:
        return jsonify({'error': 'Доска не найдена'}), 404
    current_user.unfollow_board(board)
    db.session.commit()
    try:
        on_board_changed()
    except Exception:
        pass
    return jsonify({'ok': True, 'followers': board.followers_count, 'isFollowing': False}), 200


# ── Посты доски ───────────────────────────────────────────────────────────────

@api_bp.route('/boards/<int:board_id>/posts', methods=['GET'])
def get_board_posts(board_id: int):
    board = db.session.get(Board, board_id)
    if not board:
        return jsonify({'error': 'Доска не найдена'}), 404
    posts = board.posts.order_by(Post.created_at.desc()).all()
    from .posts import post_to_dict
    return jsonify({'posts': [post_to_dict(p) for p in posts]}), 200


# ── Список всех публичных досок (для сайдбара) ────────────────────────────────

@api_bp.route('/boards', methods=['GET'])
def get_boards():
    """
    GET /api/boards?limit=10&type=recommended|trending|all

    type=recommended — персональные рекомендации (левая колонка)
    type=trending    — глобальный тренд (правая колонка)
    type=all         — старое поведение (топ по followers_count)
    """
    limit        = request.args.get('limit', 10, type=int)
    list_type    = request.args.get('type', 'all')   # recommended | trending | all
    current_user = _get_current_user()

    # Пул публичных досок (берём с запасом для ранжирования)
    pool_size = min(limit * 5, 100)
    pool = Board.query.filter_by(is_public=True)\
                      .order_by(Board.followers_count.desc())\
                      .limit(pool_size).all()

    if list_type == 'recommended':
        ranked = rank_boards_personalized(pool, current_user)
    elif list_type == 'trending':
        ranked = rank_boards_trending(pool)
    else:
        # Обратная совместимость: сортировка по followers_count
        ranked = sorted(pool, key=lambda b: b.followers_count, reverse=True)

    page_boards = ranked[:limit]
    return jsonify({'boards': [board_to_dict(b, current_user) for b in page_boards]}), 200


@api_bp.route('/boards/recommended', methods=['GET'])
def get_recommended_boards():
    """
    GET /api/boards/recommended?limit=6
    Персонализированные рекомендации досок для авторизованного пользователя.
    Гостям — тот же ответ что и /boards/trending.
    """
    limit        = request.args.get('limit', 6, type=int)
    current_user = _get_current_user()

    pool_size = min(limit * 8, 150)
    pool = Board.query.filter_by(is_public=True)\
                      .order_by(Board.followers_count.desc())\
                      .limit(pool_size).all()

    ranked = rank_boards_personalized(pool, current_user)
    page_boards = ranked[:limit]
    return jsonify({'boards': [board_to_dict(b, current_user) for b in page_boards]}), 200


@api_bp.route('/boards/trending', methods=['GET'])
def get_trending_boards():
    """
    GET /api/boards/trending?limit=6
    Глобальный trending: popularity + momentum + freshness.
    Не зависит от пользователя.
    """
    limit    = request.args.get('limit', 6, type=int)
    pool_size = min(limit * 8, 150)
    pool = Board.query.filter_by(is_public=True)\
                      .order_by(Board.followers_count.desc())\
                      .limit(pool_size).all()

    ranked = rank_boards_trending(pool)
    current_user = _get_current_user()
    page_boards = ranked[:limit]
    return jsonify({'boards': [board_to_dict(b, current_user) for b in page_boards]}), 200

@api_bp.route('/boards/subscribed', methods=['GET'])
@jwt_required()  # Требуем JWT, так как нужны подписки конкретного пользователя
def get_subscribed_boards():
    """
    GET /api/boards/subscribed?limit=6
    Возвращает доски, на которые подписан текущий пользователь.
    Используется для правой колонки "Мои подписки".
    """
    try:
        user_id = int(get_jwt_identity())
    except Exception:
        return jsonify({'error': 'Неверный токен'}), 401
    
    current_user = db.session.get(User, user_id)
    if not current_user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    limit = request.args.get('limit', 6, type=int)
    # Ограничиваем максимум 20 досками
    limit = min(limit, 20)
    
    # Получаем доски, на которые подписан пользователь
    # Сортируем сначала по количеству подписчиков, затем по дате обновления
    subscribed_boards = current_user.followed_boards.order_by(
        Board.followers_count.desc(),
        Board.updated_at.desc()
    ).limit(limit).all()
    
    # Сериализуем с флагом isFollowing = True (так как это подписки пользователя)
    result = []
    for board in subscribed_boards:
        board_dict = board_to_dict(board, current_user)
        # Убеждаемся, что isFollowing = True для подписанных досок
        board_dict['isFollowing'] = True
        result.append(board_dict)
    
    return jsonify({'boards': result}), 200