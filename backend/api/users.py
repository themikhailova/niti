"""
api/users.py — управление профилями пользователей.

Эндпоинты:
  GET  /api/users/<int:id>       — публичный профиль по ID
  GET  /api/users/<username>     — публичный профиль по username
  GET  /api/users/me             — полный профиль текущего пользователя (JWT)
  PUT  /api/users/me             — обновление username / bio (JWT)
  POST /api/users/me/avatar      — загрузка / смена аватара (JWT)
  POST /api/users/<username>/follow
  POST /api/users/<username>/unfollow
  GET  /api/users/search
"""

import os
import time

from flask import current_app, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from models import Board, Post, User, db
from pydantic import BaseModel, ValidationError, field_validator
from utils import delete_avatar, get_avatar_url

from . import api_bp
from .boards import board_to_dict
from .posts import post_to_dict

# ── Константы ─────────────────────────────────────────────────────────────────

ALLOWED_AVATAR_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024  # 5 МБ
# UPLOAD_FOLDER берётся из current_app.config внутри функций


# ── Pydantic-схемы ────────────────────────────────────────────────────────────


class UpdateProfileSchema(BaseModel):
    username: str | None = None
    bio: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username: от 3 до 30 символов")
        import re

        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username: только латиница, цифры, подчёркивание")
        return v

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v):
        if v is None:
            return v
        if len(v) > 300:
            raise ValueError("Bio: не более 300 символов")
        return v


# ── Вспомогательные функции ───────────────────────────────────────────────────


def _pydantic_errors(e):
    return [
        {"field": ".".join(str(loc) for loc in err["loc"]), "message": str(err["msg"])}
        for err in e.errors()
    ]


def _get_optional_user():
    """Возвращает текущего пользователя если JWT передан, иначе None."""
    try:
        verify_jwt_in_request(optional=True)
        from flask_jwt_extended import get_jwt_identity

        identity = get_jwt_identity()
        if identity:
            return db.session.get(User, int(identity))
    except Exception:
        pass
    return g.get("current_user")


def _allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_AVATAR_EXTENSIONS
    )


def _save_avatar_file(file, user_id):
    """
    Сохраняет файл аватара в static/uploads/avatars/.
    Возвращает (relative_path, error_message).
    """
    if not _allowed_file(file.filename):
        return None, f"Допустимые форматы: {', '.join(ALLOWED_AVATAR_EXTENSIONS)}"

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_AVATAR_SIZE_BYTES:
        return None, "Файл слишком большой (максимум 5 МБ)"

    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"user_{user_id}_{int(time.time())}.{ext}"

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    dest = os.path.join(upload_folder, filename)
    if os.path.exists(dest):
        filename = f"user_{user_id}_{int(time.time())}_a.{ext}"
        dest = os.path.join(upload_folder, filename)

    file.save(dest)
    # Сохраняем только имя файла — get_avatar_url() добавит UPLOAD_FOLDER сам
    return filename, None


def _public_profile(user, current_user=None):
    """Полный профиль с постами/досками + isFollowing для текущего пользователя."""
    is_following = (
        current_user.is_following(user)
        if current_user and current_user.id != user.id
        else False
    )
    posts = user.posts.order_by(Post.created_at.desc()).limit(20).all()
    boards = user.boards.order_by(Board.created_at.desc()).all()

    return {
        "id": str(user.id),
        "displayName": user.username,
        "username": f"@{user.username}",
        "avatar": get_avatar_url(user),
        "bio": user.bio or "",
        "isFollowing": is_following,
        "stats": {
            "followers": user.followers_count,
            "following": user.following_count,
            "boards": user.boards.count(),
        },
        "boards": [board_to_dict(b, current_user) for b in boards],
        "posts": [post_to_dict(p) for p in posts],
    }


def _me_dict(user):
    """Приватный профиль (только для владельца)."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": get_avatar_url(user),
        "bio": user.bio or "",
        "followers_count": user.followers_count,
        "following_count": user.following_count,
        "posts_count": user.posts_count,
    }


# ── GET /api/users/<int:id> — публичный профиль по ID ─────────────────────────


@api_bp.route("/users/<int:user_id>", methods=["GET"])
def get_user_by_id(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    current_user = _get_optional_user()
    return jsonify(_public_profile(user, current_user)), 200


# ── GET /api/users/<username> — профиль по username ───────────────────────────


@api_bp.route("/users/<username>", methods=["GET"])
def get_user(username):
    user = User.query.filter_by(username=username).first_or_404()
    current_user = _get_optional_user()
    return jsonify(_public_profile(user, current_user)), 200


# ── GET /api/users/me — профиль текущего пользователя ────────────────────────


@api_bp.route("/users/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    return jsonify(_me_dict(user)), 200


# ── PUT /api/users/me — обновление профиля ───────────────────────────────────


@api_bp.route("/users/me", methods=["PUT"])
@jwt_required()
def update_me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404

    raw = request.get_json(silent=True) or {}

    try:
        body = UpdateProfileSchema.model_validate(raw)
    except ValidationError as e:
        errors = _pydantic_errors(e)
        return jsonify({"error": errors[0]["message"], "errors": errors}), 422

    if body.username is not None and body.username != user.username:
        existing = User.query.filter_by(username=body.username).first()
        if existing:
            return jsonify({"error": "Это имя уже занято"}), 400
        user.username = body.username

    if body.bio is not None:
        user.bio = body.bio

    db.session.commit()
    return jsonify(_me_dict(user)), 200


# ── POST /api/users/me/avatar — загрузка аватара ─────────────────────────────


@api_bp.route("/users/me/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    """
    Загрузка / смена аватара.
    Multipart/form-data, поле «avatar».
    Файлы сохраняются в static/uploads/avatars/.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404

    if "avatar" not in request.files:
        return jsonify({"error": "Файл не передан (ожидается поле «avatar»)"}), 400

    file = request.files["avatar"]
    if not file or not file.filename:
        return jsonify({"error": "Файл пустой"}), 400

    new_path, err = _save_avatar_file(file, user_id)
    if err:
        status = 413 if "слишком большой" in err else 400
        return jsonify({"error": err}), status

    # Удаляем старый аватар (если есть и не дефолтный)
    old_avatar = user.avatar
    if (
        old_avatar
        and old_avatar != "default_avatar.png"
        and not old_avatar.startswith("data:")
    ):
        try:
            delete_avatar(old_avatar)
        except Exception:
            pass  # не критично если старый файл не нашёлся

    user.avatar = new_path
    db.session.commit()

    avatar_url = get_avatar_url(user)

    # cache-buster чтобы браузер не показывал старую картинку
    avatar_url_busted = f"{avatar_url}?v={int(time.time())}"

    return jsonify(
        {
            "ok": True,
            "avatar_url": avatar_url_busted,
        }
    ), 200


# ── DELETE /api/users/me/avatar — сброс аватара на дефолтный ────────────────


@api_bp.route("/users/me/avatar", methods=["DELETE"])
@jwt_required()
def delete_avatar_endpoint():
    """Удаляет текущий аватар, сбрасывает на дефолтный."""
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404

    old_avatar = user.avatar
    if (
        old_avatar
        and old_avatar != "default_avatar.png"
        and not old_avatar.startswith("data:")
    ):
        try:
            delete_avatar(old_avatar)
        except Exception:
            pass

    user.avatar = "default_avatar.png"
    db.session.commit()

    return jsonify(
        {
            "ok": True,
            "avatar_url": get_avatar_url(user),
        }
    ), 200


# ── GET /api/users/<username>/posts ──────────────────────────────────────────


@api_bp.route("/users/<username>/posts", methods=["GET"])
def get_user_posts(username):
    user = User.query.filter_by(username=username).first_or_404()
    posts = user.posts.order_by(Post.created_at.desc()).all()
    return jsonify({"posts": [post_to_dict(p) for p in posts]}), 200


# ── POST /api/users/<username>/follow ────────────────────────────────────────


@api_bp.route("/users/<username>/follow", methods=["POST"])
@jwt_required()
def follow_user(username):
    current_user = db.session.get(User, int(get_jwt_identity()))
    if not current_user:
        return jsonify({"error": "Пользователь не найден"}), 404

    user = User.query.filter_by(username=username).first_or_404()

    if current_user.id == user.id:
        return jsonify({"error": "Нельзя подписаться на себя"}), 400

    # Идемпотентно — если уже подписан, просто возвращаем актуальное состояние
    already = current_user.is_following(user)
    if not already:
        current_user.follow(user)
        db.session.commit()

    return jsonify(
        {
            "ok": True,
            "isFollowing": True,
            "followers": user.followers_count,
        }
    ), 200


# ── POST /api/users/<username>/unfollow ──────────────────────────────────────


@api_bp.route("/users/<username>/unfollow", methods=["POST"])
@jwt_required()
def unfollow_user(username):
    current_user = db.session.get(User, int(get_jwt_identity()))
    if not current_user:
        return jsonify({"error": "Пользователь не найден"}), 404

    user = User.query.filter_by(username=username).first_or_404()

    # Идемпотентно — если уже отписан, просто возвращаем актуальное состояние
    already = current_user.is_following(user)
    if already:
        current_user.unfollow(user)
        db.session.commit()

    return jsonify(
        {
            "ok": True,
            "isFollowing": False,
            "followers": user.followers_count,
        }
    ), 200


# ── GET /api/users/search ────────────────────────────────────────────────────


@api_bp.route("/users/search", methods=["GET"])
def search_users():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"users": []}), 200

    current_user = _get_optional_user()
    users = User.query.filter(User.username.ilike(f"%{q}%")).limit(20).all()

    return jsonify(
        {
            "users": [
                {
                    "id": str(u.id),
                    "username": f"@{u.username}",
                    "displayName": u.username,
                    "avatar": get_avatar_url(u),
                    "followersCount": u.followers_count,
                    # isFollowing берётся из БД — актуальное состояние подписки
                    "isFollowing": current_user.is_following(u)
                    if current_user
                    else False,
                }
                for u in users
            ]
        }
    ), 200


# ── GET /api/users/<username>/followers ──────────────────────────────────────


@api_bp.route("/users/<username>/followers", methods=["GET"])
def get_followers(username):
    """Список подписчиков пользователя."""
    user = User.query.filter_by(username=username).first_or_404()
    current_user = _get_optional_user()

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)

    pagination = user.followers.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "users": [
                {
                    "id": str(u.id),
                    "username": f"@{u.username}",
                    "displayName": u.username,
                    "avatar": get_avatar_url(u),
                    "followersCount": u.followers_count,
                    "isFollowing": current_user.is_following(u)
                    if current_user and current_user.id != u.id
                    else False,
                }
                for u in pagination.items
            ],
            "total": pagination.total,
            "has_more": pagination.has_next,
            "page": page,
        }
    ), 200


# ── GET /api/users/<username>/following ──────────────────────────────────────


@api_bp.route("/users/<username>/following", methods=["GET"])
def get_following(username):
    """Список подписок пользователя."""
    user = User.query.filter_by(username=username).first_or_404()
    current_user = _get_optional_user()

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)

    pagination = user.following.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "users": [
                {
                    "id": str(u.id),
                    "username": f"@{u.username}",
                    "displayName": u.username,
                    "avatar": get_avatar_url(u),
                    "followersCount": u.followers_count,
                    "isFollowing": current_user.is_following(u)
                    if current_user and current_user.id != u.id
                    else False,
                }
                for u in pagination.items
            ],
            "total": pagination.total,
            "has_more": pagination.has_next,
            "page": page,
        }
    ), 200
