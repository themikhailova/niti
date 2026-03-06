"""
api/auth.py — JWT-аутентификация.

Эндпоинты:
  POST /api/auth/register  — регистрация (email + username + password)
  POST /api/auth/login     — вход (email + password)
  GET  /api/auth/me        — данные текущего пользователя
  POST /api/auth/refresh   — обновление access-токена
  POST /api/auth/logout    — инвалидация токена
"""
import re
from flask import request, jsonify
from flask_jwt_extended import (
    jwt_required, get_jwt_identity, get_jwt,
    create_access_token, create_refresh_token,
)
from pydantic import BaseModel, EmailStr, field_validator, ValidationError

from . import api_bp
from models import db, User
from utils import get_avatar_url
from extensions import limiter, jwt_blacklist   # ← из extensions, НЕ из app


# ── Вспомогательная сериализация ошибок Pydantic ─────────────────────────────

def _pydantic_errors(e) -> list[dict]:
    """Конвертирует ValidationError в JSON-совместимый список."""
    return [
        {'field': '.'.join(str(loc) for loc in err['loc']), 'message': str(err['msg'])}
        for err in e.errors()
    ]


# ── Pydantic-схемы ────────────────────────────────────────────────────────────

class RegisterSchema(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator('username')
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError('Username: от 3 до 30 символов')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username: только латиница, цифры, подчёркивание')
        return v

    @field_validator('password')
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Пароль: минимум 8 символов')
        if len(v) > 128:
            raise ValueError('Пароль слишком длинный')
        return v


class LoginSchema(BaseModel):
    identifier: str   # ← должно быть так
    password: str


# ── Вспомогательные функции ───────────────────────────────────────────────────

def _user_to_dict(user: User) -> dict:
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'avatar': get_avatar_url(user),
        'bio': user.bio or '',
        'followers_count': user.followers_count,
        'following_count': user.following_count,
        'posts_count': user.posts_count,
    }


def _make_tokens(user: User) -> tuple[str, str]:
    identity = str(user.id)
    return create_access_token(identity=identity), create_refresh_token(identity=identity)


# ── Роуты ─────────────────────────────────────────────────────────────────────

@api_bp.route('/auth/register', methods=['POST'])
@limiter.limit('5 per minute')
def register():
    try:
        body = RegisterSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({'error': _pydantic_errors(e)[0]['message'], 'errors': _pydantic_errors(e)}), 422

    if User.query.filter_by(email=body.email.lower()).first():
        return jsonify({'error': 'Этот email уже зарегистрирован'}), 400

    if User.query.filter_by(username=body.username).first():
        return jsonify({'error': 'Это имя уже занято'}), 400

    user = User(email=body.email.lower(), username=body.username)
    user.set_password(body.password)
    db.session.add(user)
    db.session.commit()

    access, refresh = _make_tokens(user)
    return jsonify({
        'user': _user_to_dict(user),
        'access_token': access,
        'refresh_token': refresh,
        'token_type': 'bearer',
    }), 201

def _find_user_by_identifier(identifier: str) -> User | None:
    if '@' in identifier:
        return User.query.filter_by(email=identifier.lower()).first()
    return User.query.filter_by(username=identifier).first()

@api_bp.route('/auth/login', methods=['POST'])
@limiter.limit('5 per minute')
def login():
    try:
        body = LoginSchema.model_validate(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({'error': _pydantic_errors(e)[0]['message'], 'errors': _pydantic_errors(e)}), 422

    user = _find_user_by_identifier(body.identifier)
    if not user or not user.check_password(body.password):
        return jsonify({'error': 'Неверный email или пароль'}), 401

    access, refresh = _make_tokens(user)
    return jsonify({
        'user': _user_to_dict(user),
        'access_token': access,
        'refresh_token': refresh,
        'token_type': 'bearer',
    }), 200


@api_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    return jsonify(_user_to_dict(user)), 200


@api_bp.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())
    new_access = create_access_token(identity=str(user_id))
    return jsonify({'access_token': new_access, 'token_type': 'bearer'}), 200


@api_bp.route('/auth/logout', methods=['POST'])
@jwt_required(verify_type=False)
def logout():
    jti = get_jwt()['jti']
    jwt_blacklist.add(jti)
    return jsonify({'ok': True}), 200