from flask import request, jsonify, g
from . import api_bp
from models import db, Post, User
from utils import get_avatar_url, save_avatar, delete_avatar


def user_profile_to_dict(user, current_user=None):
    posts = user.posts.order_by(Post.created_at.desc()).limit(20).all()
    is_following = current_user.is_following(user) if current_user and current_user != user else False

    return {
        'id': str(user.id),
        'displayName': user.username,
        'username': f'@{user.username}',
        'avatar': get_avatar_url(user),
        'bio': '',  # Поле bio можно добавить в модель User при необходимости
        'isFollowing': is_following,
        'stats': {
            'followers': user.followers_count,
            'following': user.following_count,
            'boards': 0,  # Boards пока mock
        },
        'boards': [],   # Boards пока mock — заглушка
        'posts': [
            {
                'id': str(p.id),
                'author': {
                    'id': str(user.id),
                    'name': user.username,
                    'username': f'@{user.username}',
                    'avatar': get_avatar_url(user),
                },
                'content': {
                    'type': 'text',
                    'text': p.content,
                    'title': p.content[:60] + '...' if len(p.content) > 60 else p.content,
                },
                'engagement': {'reactions': 0, 'comments': 0, 'saves': 0},
                'timestamp': p.created_at.strftime('%d.%m.%Y'),
            }
            for p in posts
        ],
    }


@api_bp.route('/users/<username>', methods=['GET'])
def get_user(username):
    user = User.query.filter_by(username=username).first_or_404()
    return jsonify(user_profile_to_dict(user, g.current_user))


@api_bp.route('/users/<username>/posts', methods=['GET'])
def get_user_posts(username):
    user = User.query.filter_by(username=username).first_or_404()
    posts = user.posts.order_by(Post.created_at.desc()).all()
    return jsonify({
        'posts': [
            {
                'id': str(p.id),
                'author': {
                    'id': str(user.id),
                    'name': user.username,
                    'username': f'@{user.username}',
                    'avatar': get_avatar_url(user),
                },
                'content': {'type': 'text', 'text': p.content},
                'engagement': {'reactions': 0, 'comments': 0, 'saves': 0},
                'timestamp': p.created_at.strftime('%d.%m.%Y'),
            }
            for p in posts
        ]
    })


@api_bp.route('/users/<username>/follow', methods=['POST'])
def follow_user(username):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    user = User.query.filter_by(username=username).first_or_404()
    if g.current_user.follow(user):
        db.session.commit()
    return jsonify({'ok': True, 'followers': user.followers_count})


@api_bp.route('/users/<username>/unfollow', methods=['POST'])
def unfollow_user(username):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    user = User.query.filter_by(username=username).first_or_404()
    if g.current_user.unfollow(user):
        db.session.commit()
    return jsonify({'ok': True, 'followers': user.followers_count})


@api_bp.route('/users/me', methods=['PATCH'])
def update_me():
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    user = g.current_user

    # Аватар
    if 'avatar' in request.files:
        file = request.files['avatar']
        if file.filename:
            old_avatar = user.avatar
            filename, err = save_avatar(file, user.username)
            if err:
                return jsonify({'error': err}), 400
            user.avatar = filename
            delete_avatar(old_avatar)

    db.session.commit()
    return jsonify({
        'id': user.id,
        'username': user.username,
        'avatar': get_avatar_url(user),
        'followers_count': user.followers_count,
        'following_count': user.following_count,
        'posts_count': user.posts_count,
    })
