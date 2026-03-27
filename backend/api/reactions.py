"""
api/reactions.py
────────────────
Эндпоинты реакций.

POST /api/posts/<post_id>/react      — toggle реакции (JWT обязателен)
GET  /api/posts/<post_id>/reactions  — статистика реакций (публично)
GET  /api/posts/<post_id>/reactions/<type>/users  — кто поставил (публично, MVP-опция)
"""
from __future__ import annotations

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import BaseModel, field_validator, ValidationError

from . import api_bp
from models import ReactionTypeEnum
from services.reaction_service import ReactionService, reaction_counts_to_dict


# ── Pydantic-схемы ────────────────────────────────────────────────────────────

_VALID_TYPES = {t.value for t in ReactionTypeEnum}


class ReactSchema(BaseModel):
    type: str

    @field_validator('type')
    @classmethod
    def type_valid(cls, v: str) -> str:
        if v not in _VALID_TYPES:
            valid = ', '.join(sorted(_VALID_TYPES))
            raise ValueError(
                f'Неверный тип реакции «{v}». Допустимые значения: {valid}'
            )
        return v


# ── Вспомогательные функции ───────────────────────────────────────────────────

def _pydantic_errors(e: ValidationError) -> list[dict]:
    return [
        {'field': '.'.join(str(loc) for loc in err['loc']), 'message': str(err['msg'])}
        for err in e.errors()
    ]


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@api_bp.route('/posts/<int:post_id>/react', methods=['POST'])
@jwt_required()
def toggle_reaction(post_id: int):
    """
    POST /api/posts/<post_id>/react
    Body: { "type": "like" }

    Toggle-логика:
      - если реакция отсутствует → создаётся, added=true
      - если реакция уже есть    → удаляется, added=false

    Возвращает актуальные счётчики всех типов реакций.
    """
    user_id = int(get_jwt_identity())

    try:
        body = ReactSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        errs = _pydantic_errors(e)
        return jsonify({'error': errs[0]['message'], 'errors': errs}), 422

    try:
        added, counts = ReactionService.toggle(post_id, user_id, body.type)
    except LookupError as e:
        return jsonify({'error': str(e)}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({
        'added':     added,
        'type':      body.type,
        'reactions': [
            {'type': k, 'count': v}
            for k, v in counts.items()
        ],
    }), 200


@api_bp.route('/posts/<int:post_id>/reactions', methods=['GET'])
def get_reactions(post_id: int):
    """
    GET /api/posts/<post_id>/reactions
    Публичный эндпоинт. Возвращает счётчики всех типов реакций.

    Пример ответа:
    {
      "reactions": [
        { "type": "like",  "emoji": "❤️",  "count": 12 },
        { "type": "fire",  "emoji": "🔥",  "count": 4  },
        ...
      ]
    }
    """
    try:
        reactions = ReactionService.get_counts(post_id)
    except LookupError as e:
        return jsonify({'error': str(e)}), 404

    return jsonify({'reactions': reactions}), 200


@api_bp.route('/posts/<int:post_id>/reactions/<reaction_type>/users', methods=['GET'])
def get_reaction_users(post_id: int, reaction_type: str):
    """
    GET /api/posts/<post_id>/reactions/<type>/users
    Список пользователей, поставивших конкретную реакцию (MVP-опция).
    """
    try:
        users = ReactionService.get_users_for_reaction(post_id, reaction_type)
    except LookupError as e:
        return jsonify({'error': str(e)}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({'users': users, 'type': reaction_type}), 200
