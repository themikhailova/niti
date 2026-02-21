from flask import Blueprint, request, jsonify, g, current_app
from sqlalchemy import text
from models import db, Post, User
from utils import RecommendationEngine

posts_bp = Blueprint('posts', __name__)


def post_to_dict(post, current_user=None):
    u = post.user
    return {
        'id': post.id,
        'content': post.content,
        'created_at': post.created_at.isoformat(),
        'author': {
            'id': u.id,
            'username': u.username,
            'avatar': u.avatar,
        },
        'is_own': current_user and post.user_id == current_user.id,
    }


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not g.current_user:
            return jsonify({'error': 'Не авторизован'}), 401
        return f(*args, **kwargs)
    return decorated


@posts_bp.route('', methods=['GET'])
@login_required
def get_feed():
    page = request.args.get('page', 1, type=int)
    mode = request.args.get('mode', 'balanced')
    per_page = current_app.config['POSTS_PER_PAGE']

    followed_ids = [u.id for u in g.current_user.following.all()]
    all_posts = Post.query.filter(
        Post.user_id.in_(followed_ids + [g.current_user.id])
    ).options(
        db.joinedload(Post.user)
    ).order_by(Post.created_at.desc()).limit(100).all()

    if all_posts:
        recommended = RecommendationEngine.get_recommended_posts(
            g.current_user, all_posts, mode=mode
        )
    else:
        recommended = []

    total = len(recommended)
    start = (page - 1) * per_page
    end = start + per_page
    page_posts = recommended[start:end]

    return jsonify({
        'posts': [post_to_dict(p, g.current_user) for p in page_posts],
        'page': page,
        'has_more': end < total,
        'total': total,
    })


@posts_bp.route('', methods=['POST'])
@login_required
def create_post():
    data = request.get_json()
    content = (data.get('content') or '').strip() if data else ''

    is_valid, error = Post.validate_content(content)
    if not is_valid:
        return jsonify({'error': error}), 422

    try:
        post = Post(content=content, user_id=g.current_user.id)
        db.session.add(post)
        g.current_user.posts_count += 1
        db.session.commit()
        db.session.refresh(post)
        return jsonify(post_to_dict(post, g.current_user)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Ошибка при создании поста'}), 500


@posts_bp.route('/<int:post_id>', methods=['DELETE'])
@login_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)

    if post.user_id != g.current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    try:
        db.session.delete(post)
        g.current_user.posts_count = max(0, g.current_user.posts_count - 1)
        db.session.commit()
        return jsonify({'message': 'Удалено'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Ошибка при удалении'}), 500
