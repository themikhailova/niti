from flask import Blueprint, request, jsonify, g, current_app
from models import User

search_bp = Blueprint('search', __name__)


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not g.current_user:
            return jsonify({'error': 'Не авторизован'}), 401
        return f(*args, **kwargs)
    return decorated


@search_bp.route('', methods=['GET'])
@login_required
def search():
    query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = current_app.config['USERS_PER_PAGE']

    if not query:
        popular = User.query.order_by(User.followers_count.desc()).limit(8).all()
        return jsonify({
            'users': [],
            'popular_users': [_user_dict(u) for u in popular],
            'query': '',
        })

    pagination = User.query.filter(
        User.username.ilike(f'{query}%')
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'users': [_user_dict(u) for u in pagination.items],
        'popular_users': [],
        'query': query,
        'page': page,
        'has_more': pagination.has_next,
    })


def _user_dict(user):
    return {
        'id': user.id,
        'username': user.username,
        'avatar': user.avatar,
        'followers_count': user.followers_count,
        'posts_count': user.posts_count,
        'interests': user.interests or [],
    }
