from flask import request, jsonify, g, current_app
from sqlalchemy import text
from . import api_bp
from models import db, Post, User
from utils import get_avatar_url, RecommendationEngine


def post_to_dict(post):
    author = post.user
    return {
        'id': str(post.id),
        'author': {
            'id': str(author.id),
            'name': author.username,
            'username': f'@{author.username}',
            'avatar': get_avatar_url(author),
        },
        'content': {
            'type': 'text',
            'text': post.content,
        },
        'engagement': {
            'reactions': 0,
            'comments': 0,
            'saves': 0,
        },
        'timestamp': post.created_at.strftime('%d.%m.%Y %H:%M'),
    }


@api_bp.route('/posts/feed', methods=['GET'])
def feed():
    """Лента постов с рекомендациями"""
    page = request.args.get('page', 1, type=int)
    per_page = current_app.config.get('POSTS_PER_PAGE', 20)

    if g.current_user:
        # Получаем посты пользователей, на которых подписан
        followed_ids = [u.id for u in g.current_user.following]
        followed_ids.append(g.current_user.id)

        all_posts = Post.query.filter(
            Post.user_id.in_(followed_ids)
        ).order_by(Post.created_at.desc()).all()

        # Рекомендательная система
        mode = request.args.get('mode', 'balanced')
        posts = RecommendationEngine.get_recommended_posts(g.current_user, all_posts, mode)
    else:
        # Гость видит публичную ленту
        posts = Post.query.order_by(Post.created_at.desc()).limit(per_page * page).all()

    # Пагинация
    start = (page - 1) * per_page
    page_posts = posts[start:start + per_page]

    return jsonify({
        'posts': [post_to_dict(p) for p in page_posts],
        'page': page,
        'has_more': len(posts) > start + per_page,
    })


@api_bp.route('/posts', methods=['POST'])
def create_post():
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    data = request.get_json() or {}
    content = (data.get('content') or '').strip()

    valid, err = Post.validate_content(content)
    if not valid:
        return jsonify({'error': err}), 400

    post = Post(content=content, user_id=g.current_user.id)
    g.current_user.posts_count += 1
    db.session.add(post)
    db.session.commit()

    return jsonify(post_to_dict(post)), 201


@api_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    post = Post.query.get_or_404(post_id)
    if post.user_id != g.current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    g.current_user.posts_count = max(0, g.current_user.posts_count - 1)
    db.session.delete(post)
    db.session.commit()
    return jsonify({'ok': True})
