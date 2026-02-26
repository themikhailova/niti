from flask import request, jsonify, g
from . import api_bp
from models import db, Post, User, Board
from utils import get_avatar_url, save_avatar, delete_avatar
from .boards import board_to_dict
from .posts import post_to_dict


def user_profile_to_dict(user, current_user=None):
    is_following = current_user.is_following(user) if current_user and current_user != user else False
    posts = user.posts.order_by(Post.created_at.desc()).limit(20).all()
    boards = user.boards.order_by(Board.created_at.desc()).all()

    return {
        'id': str(user.id),
        'displayName': user.username,
        'username': f'@{user.username}',
        'avatar': get_avatar_url(user),
        'bio': user.bio or '',
        'isFollowing': is_following,
        'stats': {
            'followers': user.followers_count,
            'following': user.following_count,
            'boards': user.boards.count(),
        },
        'boards': [board_to_dict(b, current_user) for b in boards],
        'posts': [post_to_dict(p) for p in posts],
    }


@api_bp.route('/users/search', methods=['GET'])
def search_users():
    """Поиск пользователей по username"""
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify({'users': []})

    users = User.query.filter(
        User.username.ilike(f'%{q}%')
    ).limit(20).all()

    return jsonify({
        'users': [
            {
                'id': str(u.id),
                'username': f'@{u.username}',
                'displayName': u.username,
                'avatar': get_avatar_url(u),
                'followersCount': u.followers_count,
                'isFollowing': g.current_user.is_following(u) if g.current_user else False,
            }
            for u in users
        ]
    })


@api_bp.route('/users/<username>', methods=['GET'])
def get_user(username):
    user = User.query.filter_by(username=username).first_or_404()
    return jsonify(user_profile_to_dict(user, g.current_user))


@api_bp.route('/users/<username>/posts', methods=['GET'])
def get_user_posts(username):
    user = User.query.filter_by(username=username).first_or_404()
    posts = user.posts.order_by(Post.created_at.desc()).all()
    return jsonify({'posts': [post_to_dict(p) for p in posts]})


@api_bp.route('/users/<username>/follow', methods=['POST'])
def follow_user(username):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401
    user = User.query.filter_by(username=username).first_or_404()
    g.current_user.follow(user)
    db.session.commit()
    return jsonify({'ok': True, 'followers': user.followers_count})


@api_bp.route('/users/<username>/unfollow', methods=['POST'])
def unfollow_user(username):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401
    user = User.query.filter_by(username=username).first_or_404()
    g.current_user.unfollow(user)
    db.session.commit()
    return jsonify({'ok': True, 'followers': user.followers_count})


@api_bp.route('/users/me', methods=['PATCH'])
def update_me():
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    user = g.current_user

    if 'avatar' in request.files:
        file = request.files['avatar']
        if file.filename:
            old_avatar = user.avatar
            filename, err = save_avatar(file, user.username)
            if err:
                return jsonify({'error': err}), 400
            user.avatar = filename
            delete_avatar(old_avatar)

    # Обновление bio
    data = request.form or {}
    if 'bio' in data:
        user.bio = data['bio'][:300]

    db.session.commit()
    return jsonify({
        'id': user.id,
        'username': user.username,
        'avatar': get_avatar_url(user),
        'bio': user.bio or '',
        'followers_count': user.followers_count,
        'following_count': user.following_count,
        'posts_count': user.posts_count,
    })