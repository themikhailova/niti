from flask import request, jsonify, g
from . import api_bp
from models import db, Board, Post
from utils import get_avatar_url


def board_to_dict(board, current_user=None):
    is_following = current_user.is_following_board(board) if current_user else False
    return {
        'id': str(board.id),
        'name': board.name,
        'description': board.description or '',
        'coverImage': board.cover_image or '',
        'tags': board.tags or [],
        'followers': board.followers_count,
        'postCount': board.post_count,
        'collaborators': board.collaborators_count,
        'isFollowing': is_following,
        'creator': {
            'id': str(board.creator_id),
            'username': f'@{board.creator.username}',
            'avatar': get_avatar_url(board.creator),
        },
    }


@api_bp.route('/boards', methods=['GET'])
def get_boards():
    """Список публичных досок (для сайдбаров)"""
    limit = request.args.get('limit', 10, type=int)
    boards = Board.query.filter_by(is_public=True)\
        .order_by(Board.followers_count.desc())\
        .limit(limit).all()
    return jsonify({'boards': [board_to_dict(b, g.current_user) for b in boards]})


@api_bp.route('/boards', methods=['POST'])
def create_board():
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()

    valid, err = Board.validate_name(name)
    if not valid:
        return jsonify({'error': err}), 400

    board = Board(
        name=name,
        description=(data.get('description') or '').strip(),
        tags=data.get('tags') or [],
        cover_image=data.get('coverImage') or None,
        is_public=data.get('isPublic', True),
        creator_id=g.current_user.id,
    )
    db.session.add(board)
    db.session.commit()
    return jsonify(board_to_dict(board, g.current_user)), 201


@api_bp.route('/boards/<int:board_id>', methods=['GET'])
def get_board(board_id):
    board = Board.query.get_or_404(board_id)
    return jsonify(board_to_dict(board, g.current_user))


@api_bp.route('/boards/<int:board_id>', methods=['PATCH'])
def update_board(board_id):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    board = Board.query.get_or_404(board_id)
    if board.creator_id != g.current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    data = request.get_json() or {}
    if 'name' in data:
        valid, err = Board.validate_name(data['name'])
        if not valid:
            return jsonify({'error': err}), 400
        board.name = data['name'].strip()
    if 'description' in data:
        board.description = data['description'].strip()
    if 'tags' in data:
        board.tags = data['tags']
    if 'isPublic' in data:
        board.is_public = data['isPublic']

    db.session.commit()
    return jsonify(board_to_dict(board, g.current_user))


@api_bp.route('/boards/<int:board_id>', methods=['DELETE'])
def delete_board(board_id):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    board = Board.query.get_or_404(board_id)
    if board.creator_id != g.current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    db.session.delete(board)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/boards/<int:board_id>/follow', methods=['POST'])
def follow_board(board_id):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    board = Board.query.get_or_404(board_id)
    g.current_user.follow_board(board)
    db.session.commit()
    return jsonify({'ok': True, 'followers': board.followers_count, 'isFollowing': True})


@api_bp.route('/boards/<int:board_id>/unfollow', methods=['POST'])
def unfollow_board(board_id):
    if not g.current_user:
        return jsonify({'error': 'Требуется авторизация'}), 401

    board = Board.query.get_or_404(board_id)
    g.current_user.unfollow_board(board)
    db.session.commit()
    return jsonify({'ok': True, 'followers': board.followers_count, 'isFollowing': False})


@api_bp.route('/boards/<int:board_id>/posts', methods=['GET'])
def get_board_posts(board_id):
    board = Board.query.get_or_404(board_id)
    posts = board.posts.order_by(Post.created_at.desc()).all()
    from .posts import post_to_dict
    return jsonify({'posts': [post_to_dict(p) for p in posts]})


@api_bp.route('/users/<username>/boards', methods=['GET'])
def get_user_boards(username):
    from models import User
    user = User.query.filter_by(username=username).first_or_404()
    boards = user.boards.order_by(Board.created_at.desc()).all()
    return jsonify({'boards': [board_to_dict(b, g.current_user) for b in boards]})