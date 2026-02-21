from flask import Blueprint, request, jsonify, g, current_app
from models import db, User, Post
from utils import save_avatar, delete_avatar, get_avatar_url

users_bp = Blueprint('users', __name__)


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not g.current_user:
            return jsonify({'error': 'Не авторизован'}), 401
        return f(*args, **kwargs)
    return decorated


def user_to_dict(user, current_user=None):
    return {
        'id': user.id,
        'username': user.username,
        'avatar': user.avatar,
        'interests': user.interests or [],
        'followers_count': user.followers_count,
        'following_count': user.following_count,
        'posts_count': user.posts_count,
        'created_at': user.created_at.isoformat(),
        'is_following': current_user.is_following(user) if current_user and current_user != user else False,
        'is_own': current_user and current_user.id == user.id,
    }


@users_bp.route('/<username>', methods=['GET'])
@login_required
def get_profile(username):
    user = User.query.filter_by(username=username).first_or_404()
    page = request.args.get('page', 1, type=int)
    per_page = current_app.config['POSTS_PER_PAGE']

    pagination = Post.query.filter_by(user_id=user.id)\
        .order_by(Post.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)

    posts = [{
        'id': p.id,
        'content': p.content,
        'created_at': p.created_at.isoformat(),
        'is_own': g.current_user.id == p.user_id,
    } for p in pagination.items]

    return jsonify({
        'user': user_to_dict(user, g.current_user),
        'posts': posts,
        'page': page,
        'has_more': pagination.has_next,
    })


@users_bp.route('/<username>/follow', methods=['POST'])
@login_required
def follow(username):
    user = User.query.filter_by(username=username).first_or_404()

    if user == g.current_user:
        return jsonify({'error': 'Нельзя подписаться на себя'}), 400

    try:
        if g.current_user.follow(user):
            db.session.commit()
            return jsonify({'success': True, 'followers_count': user.followers_count})
        return jsonify({'error': 'Уже подписан'}), 409
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Ошибка'}), 500


@users_bp.route('/<username>/unfollow', methods=['POST'])
@login_required
def unfollow(username):
    user = User.query.filter_by(username=username).first_or_404()

    try:
        if g.current_user.unfollow(user):
            db.session.commit()
            return jsonify({'success': True, 'followers_count': user.followers_count})
        return jsonify({'error': 'Не подписан'}), 409
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Ошибка'}), 500


@users_bp.route('/me/profile', methods=['PATCH'])
@login_required
def edit_profile():
    # Мультипарт для аватара
    interests_raw = request.form.get('interests', '')
    avatar_file = request.files.get('avatar')

    if avatar_file:
        filename, error = save_avatar(avatar_file, g.current_user.username)
        if error:
            return jsonify({'error': error}), 422
        delete_avatar(g.current_user.avatar)
        g.current_user.avatar = filename

    if interests_raw is not None:
        interests_list = [i.strip() for i in interests_raw.split(',') if i.strip()]
        g.current_user.interests = interests_list[:20]

    try:
        db.session.commit()
        return jsonify({'user': user_to_dict(g.current_user, g.current_user)})
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Ошибка при сохранении'}), 500
