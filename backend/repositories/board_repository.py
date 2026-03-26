"""
repositories/board_repository.py
─────────────────────────────────
Все прямые запросы к БД для Board.
Никакой бизнес-логики.
"""
from __future__ import annotations
from typing import Optional
from models import db, Board, Post


class BoardRepository:

    # ── Чтение ────────────────────────────────────────────────────────────────

    @staticmethod
    def get_by_id(board_id: int) -> Optional[Board]:
        return db.session.get(Board, board_id)

    @staticmethod
    def get_public_by_id(board_id: int) -> Optional[Board]:
        return Board.query.filter_by(id=board_id, is_public=True).first()

    @staticmethod
    def get_by_user(user_id: int) -> list[Board]:
        """Все доски пользователя (включая приватные) — для владельца."""
        return (
            Board.query
            .filter_by(creator_id=user_id)
            .order_by(Board.created_at.desc())
            .all()
        )

    @staticmethod
    def get_public_by_user(user_id: int) -> list[Board]:
        """Только публичные доски — для чужого профиля."""
        return (
            Board.query
            .filter_by(creator_id=user_id, is_public=True)
            .order_by(Board.created_at.desc())
            .all()
        )

    @staticmethod
    def get_public_list(limit: int = 10) -> list[Board]:
        return (
            Board.query
            .filter_by(is_public=True)
            .order_by(Board.followers_count.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def find_by_name_and_owner(name: str, user_id: int) -> Optional[Board]:
        """Проверка дубля названия у одного владельца."""
        return Board.query.filter_by(
            creator_id=user_id,
            name=name.strip(),
        ).first()

    @staticmethod
    def has_posts(board_id: int) -> bool:
        return Post.query.filter_by(board_id=board_id).count() > 0

    # ── Запись ────────────────────────────────────────────────────────────────

    @staticmethod
    def create(
        name: str,
        description: str,
        tags: list[str],
        is_public: bool,
        creator_id: int,
        cover_image: Optional[str] = None,
    ) -> Board:
        board = Board(
            name=name.strip(),
            description=description.strip(),
            tags=tags,
            is_public=is_public,
            creator_id=creator_id,
            cover_image=cover_image,
        )
        db.session.add(board)
        return board

    @staticmethod
    def detach_posts(board: Board) -> int:
        """Разрываем связь постов с доской (board_id → NULL). Возвращает кол-во постов."""
        count = board.posts.count()
        Post.query.filter_by(board_id=board.id).update({'board_id': None})
        return count

    @staticmethod
    def delete(board: Board) -> None:
        db.session.delete(board)
