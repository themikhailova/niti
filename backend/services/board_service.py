"""
services/board_service.py
─────────────────────────
Бизнес-логика для досок.
Никаких прямых запросов к БД — только через BoardRepository.
"""
from __future__ import annotations
from typing import Optional
from models import db, Board, User
from repositories.board_repository import BoardRepository
from utils import get_avatar_url


# ── Сериализация ──────────────────────────────────────────────────────────────

def board_to_dict(board: Board, current_user: Optional[User] = None) -> dict:
    is_following = (
        current_user.is_following_board(board)
        if current_user and current_user.id != board.creator_id
        else False
    )
    return {
        'id': str(board.id),
        'name': board.name,
        'description': board.description or '',
        'coverImage': board.cover_image or '',
        'tags': board.tags or [],
        'isPublic': board.is_public,
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


# ── Бизнес-операции ───────────────────────────────────────────────────────────

class BoardService:

    # ── Список / одиночное получение ──────────────────────────────────────────

    @staticmethod
    def get_public(board_id: int) -> Board:
        board = BoardRepository.get_by_id(board_id)
        if board is None:
            raise LookupError('Доска не найдена')
        if not board.is_public:
            raise LookupError('Доска не найдена')
        return board

    @staticmethod
    def get_any(board_id: int) -> Board:
        """Для внутреннего использования (Follow/Unfollow и т.д.)."""
        board = BoardRepository.get_by_id(board_id)
        if board is None:
            raise LookupError('Доска не найдена')
        return board

    @staticmethod
    def get_my_boards(user_id: int) -> list[Board]:
        return BoardRepository.get_by_user(user_id)

    @staticmethod
    def get_user_boards(user_id: int) -> list[Board]:
        """Публичные доски другого пользователя."""
        user = db.session.get(User, user_id)
        if user is None:
            raise LookupError('Пользователь не найден')
        return BoardRepository.get_public_by_user(user_id)

    @staticmethod
    def get_public_list(limit: int = 10) -> list[Board]:
        return BoardRepository.get_public_list(limit)

    # ── Создание ──────────────────────────────────────────────────────────────

    @staticmethod
    def create(
        user_id: int,
        name: str,
        description: str = '',
        tags: list[str] | None = None,
        is_public: bool = True,
        cover_image: Optional[str] = None,
    ) -> Board:
        name = name.strip()

        # Дубль названия у одного владельца → 400
        if BoardRepository.find_by_name_and_owner(name, user_id):
            raise ValueError('У вас уже есть доска с таким названием')

        board = BoardRepository.create(
            name=name,
            description=description,
            tags=tags or [],
            is_public=is_public,
            creator_id=user_id,
            cover_image=cover_image,
        )
        db.session.commit()
        return board

    # ── Обновление ────────────────────────────────────────────────────────────

    @staticmethod
    def update(
        board_id: int,
        user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[list[str]] = None,
        is_public: Optional[bool] = None,
        cover_image: Optional[str] = None,
    ) -> Board:
        board = BoardRepository.get_by_id(board_id)
        if board is None:
            raise LookupError('Доска не найдена')
        if board.creator_id != user_id:
            raise PermissionError('Нет прав на редактирование этой доски')

        if name is not None:
            name = name.strip()
            # Дубль у того же владельца, но другая доска
            existing = BoardRepository.find_by_name_and_owner(name, user_id)
            if existing and existing.id != board_id:
                raise ValueError('У вас уже есть доска с таким названием')
            valid, err = Board.validate_name(name)
            if not valid:
                raise ValueError(err)
            board.name = name

        if description is not None:
            board.description = description.strip()
        if tags is not None:
            board.tags = tags
        if is_public is not None:
            board.is_public = is_public
        if cover_image is not None:
            board.cover_image = cover_image

        db.session.commit()
        return board

    # ── Удаление ──────────────────────────────────────────────────────────────

    @staticmethod
    def delete(board_id: int, user_id: int, force: bool = False) -> dict:
        """
        Удалить доску.
        force=False → 409 если в доске есть посты.
        force=True  → разрываем связь с постами, затем удаляем.
        """
        board = BoardRepository.get_by_id(board_id)
        if board is None:
            raise LookupError('Доска не найдена')
        if board.creator_id != user_id:
            raise PermissionError('Нет прав на удаление этой доски')

        post_count = board.posts.count()
        if post_count > 0:
            if not force:
                raise ConflictError(
                    f'В доске {post_count} постов. '
                    'Удалите посты или используйте параметр force=true для разрыва связей.'
                )
            # Мягкое удаление связей
            BoardRepository.detach_posts(board)
            board.post_count = 0

        BoardRepository.delete(board)
        db.session.commit()
        return {'ok': True, 'detached_posts': post_count if force else 0}


class ConflictError(Exception):
    """409 Conflict — нельзя удалить доску с постами."""
