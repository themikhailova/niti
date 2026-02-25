from flask import request, jsonify, session, g
from . import api_bp
from models import db, User
from utils import get_avatar_url


def user_to_dict(user):
    return {
        'id': user.id,
        'username': user.username,
        'avatar': get_avatar_url(user),
        'followers_count': user.followers_count,
        'following_count': user.following_count,
        'posts_count': user.posts_count,
    }


@api_bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    valid, err = User.validate_username(username)
    if not valid:
        return jsonify({'error': err}), 400

    valid, err = User.validate_password(password)
    if not valid:
        return jsonify({'error': err}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Это имя уже занято'}), 409

    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session['user_id'] = user.id
    session.permanent = True
    return jsonify(user_to_dict(user)), 201


@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Неверное имя пользователя или пароль'}), 401

    session['user_id'] = user.id
    session.permanent = True
    return jsonify(user_to_dict(user)), 200


@api_bp.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True}), 200


@api_bp.route('/auth/me', methods=['GET'])
def me():
    if not g.current_user:
        return jsonify({'error': 'Не авторизован'}), 401
    return jsonify(user_to_dict(g.current_user)), 200
