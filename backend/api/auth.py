from flask import Blueprint, request, jsonify, session, g
from models import db, User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    print("Content-Type:", request.content_type)
    print("Raw data:", request.data)
    data = request.get_json(silent=True, force=True)  
    print("Parsed JSON:", data)
    if not data:
        return jsonify({'error': 'Нет данных'}), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    is_valid, error = User.validate_username(username)
    if not is_valid:
        return jsonify({'error': error}), 422

    is_valid, error = User.validate_password(password)
    if not is_valid:
        return jsonify({'error': error}), 422

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Это имя уже занято'}), 409

    try:
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return jsonify({'message': 'Аккаунт создан'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Ошибка сервера'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Нет данных'}), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Неверное имя или пароль'}), 401

    session.clear()
    session.permanent = True
    session['user_id'] = user.id

    return jsonify({
        'user': {
            'id': user.id,
            'username': user.username,
            'avatar': user.avatar,
            'interests': user.interests or [],
            'followers_count': user.followers_count,
            'following_count': user.following_count,
            'posts_count': user.posts_count,
        }
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Выход выполнен'})


@auth_bp.route('/me', methods=['GET'])
def me():
    if not g.current_user:
        return jsonify({'error': 'Не авторизован'}), 401

    u = g.current_user
    return jsonify({
        'user': {
            'id': u.id,
            'username': u.username,
            'avatar': u.avatar,
            'interests': u.interests or [],
            'followers_count': u.followers_count,
            'following_count': u.following_count,
            'posts_count': u.posts_count,
            'created_at': u.created_at.isoformat(),
        }
    })
