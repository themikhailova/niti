from flask import request, jsonify, g, current_app
from . import api_bp
from models import db, Post, Board
from utils import get_avatar_url, RecommendationEngine


def post_to_dict(post):
    author = post.user

    content = {'type': post.post_type}
    if post.title:
        content['title'] = post.title
    if post.image_url:
        content['imageUrl'] = post.image_url
    if post.content:
        if post.post_type == Post.TYPE_TEXT:
            content['text'] = post.content
        else:
            content['caption'] = post.content

    source_board = None
    if post.board_id and post.board:
        source_board = {'id': str(post.board_id), 'name': post.board.name}

    return {
        'id': str(post.id),
        'author': {
            'id': str(author.id),
            'name': author.username,
            'username': f'@{author.username}',
            'avatar': get_avatar_url(author),
        },
        'sourceBoard': source_board,
        'content': content,
        'engagement': {'reactions': 0, 'comments': 0, 'saves': 0},
        'timestamp': post.created_at.strftime('%d.%m.%Y %H:%M'),
    }


@api_bp.route('/posts/feed', methods=['GET'])
def feed():
    page = request.args.get('page', 1, type=int)
    per_page = current_app.config.get('POSTS_PER_PAGE', 20)

    if g.current_user:
        followed_ids = [u.id for u in g.current_user.following]
        followed_ids.append(g.current_user.id)
        all_posts = Post.query.filter(
            Post.user_id.in_(followed_ids)
        ).order_by(Post.created_at.desc()).all()
        mode = request.args.get('mode', 'balanced')
        posts = RecommendationEngine.get_recommended_posts(g.current_user, all_posts, mode)
    else:
        posts = Post.query.order_by(Post.created_at.desc()).limit(per_page * page).all()

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
    post_type = data.get('postType', Post.TYPE_TEXT)
    content_text = (data.get('content') or '').strip() or None
    title = (data.get('title') or '').strip() or None
    image_url = (data.get('imageUrl') or '').strip() or None
    board_id = data.get('boardId') or None

    valid, err = Post.validate_content(content_text, post_type, image_url)
    if not valid:
        return jsonify({'error': err}), 400

    board = None
    if board_id:
        board = Board.query.get(int(board_id))
        if not board:
            return jsonify({'error': 'Доска не найдена'}), 404

    post = Post(
        post_type=post_type,
        content=content_text,
        title=title,
        image_url=image_url,
        user_id=g.current_user.id,
        board_id=board.id if board else None,
    )
    g.current_user.posts_count += 1
    if board:
        board.post_count += 1

    db.session.add(post)
    db.session.commit()
    return jsonify(post_to_dict(post)), 201


@api_bp.route('/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    post = Post.query.get_or_404(post_id)
    return jsonify(post_to_dict(post))


@api_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    post = Post.query.get_or_404(post_id)
    if post.user_id != g.current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    g.current_user.posts_count = max(0, g.current_user.posts_count - 1)
    if post.board_id and post.board:
        post.board.post_count = max(0, post.board.post_count - 1)

    db.session.delete(post)
    db.session.commit()
    return jsonify({'ok': True})