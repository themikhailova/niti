"""
api/comments.py
───────────────
Эндпоинты комментариев.

POST   /api/posts/<post_id>/comments   — добавить комментарий
GET    /api/posts/<post_id>/comments   — список (пагинация)
PUT    /api/comments/<comment_id>      — редактировать (только автор)
DELETE /api/comments/<comment_id>      — удалить (только автор)
"""
from __future__ import annotations

from typing import Optional

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import BaseModel, field_validator, ValidationError

from . import api_bp
from services.comment_service import CommentService, comment_to_dict


# ── Pydantic-схемы ────────────────────────────────────────────────────────────

class CreateCommentSchema(BaseModel):
    content: str

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Текст комментария не может быть пустым')
        if len(v) > 2000:
            raise ValueError('Комментарий слишком длинный (максимум 2000 символов)')
        return v


class UpdateCommentSchema(BaseModel):
    content: str

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Текст комментария не может быть пустым')
        if len(v) > 2000:
            raise ValueError('Комментарий слишком длинный (максимум 2000 символов)')
        return v


# ── Вспомогательные функции ───────────────────────────────────────────────────

def _pydantic_errors(e: ValidationError) -> list[dict]:
    return [
        {'field': '.'.join(str(loc) for loc in err['loc']), 'message': str(err['msg'])}
        for err in e.errors()
    ]


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@api_bp.route('/posts/<int:post_id>/comments', methods=['POST'])
@jwt_required()
def add_comment(post_id: int):
    """
    POST /api/posts/<post_id>/comments
    Добавить комментарий к посту. JWT обязателен.
    """
    user_id = int(get_jwt_identity())

    try:
        body = CreateCommentSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({'error': errs[0]['message'], 'errors': errs}), 422

    try:
        comment = CommentService.create(post_id, user_id, body.content)
    except ValueError as e:
        return jsonify({'error': str(e)}), 404

    return jsonify(comment_to_dict(comment, viewer_id=user_id)), 201


@api_bp.route('/posts/<int:post_id>/comments', methods=['GET'])
def list_comments(post_id: int):
    """
    GET /api/posts/<post_id>/comments?page=1&per_page=20
    Список комментариев к посту. Авторизация не требуется.
    """
    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    # Определяем viewer_id опционально (через JWT, если передан)
    viewer_id: Optional[int] = None
    try:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            viewer_id = int(identity)
    except Exception:
        pass

    try:
        items, meta = CommentService.list_for_post(post_id, page, per_page, viewer_id)
    except ValueError as e:
        return jsonify({'error': str(e)}), 404

    return jsonify({'comments': items, 'meta': meta}), 200


@api_bp.route('/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_comment(comment_id: int):
    """
    PUT /api/comments/<comment_id>
    Редактировать комментарий. JWT обязателен. Только автор.
    """
    user_id = int(get_jwt_identity())

    try:
        body = UpdateCommentSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({'error': errs[0]['message'], 'errors': errs}), 422

    try:
        comment = CommentService.update(comment_id, user_id, body.content)
    except LookupError as e:
        return jsonify({'error': str(e)}), 404
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403

    return jsonify(comment_to_dict(comment, viewer_id=user_id)), 200


@api_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id: int):
    """
    DELETE /api/comments/<comment_id>
    Удалить комментарий. JWT обязателен. Только автор.
    """
    user_id = int(get_jwt_identity())

    try:
        CommentService.delete(comment_id, user_id)
    except LookupError as e:
        return jsonify({'error': str(e)}), 404
    except PermissionError as e:
        return jsonify({'error': str(e)}), 403

    return jsonify({'ok': True}), 200
