"""
repositories/comment_repository.py
───────────────────────────────────
Все прямые запросы к БД для Comment.
Никакой бизнес-логики — только CRUD + пагинация.
"""
from __future__ import annotations

from typing import Optional

from models import db, Comment, Post


class CommentRepository:
    """Методы доступа к таблице comment."""

    # ── Чтение ────────────────────────────────────────────────────────────────

    @staticmethod
    def get_by_id(comment_id: int) -> Optional[Comment]:
        return db.session.get(Comment, comment_id)

    @staticmethod
    def get_paginated_for_post(
        post_id: int,
        page: int,
        per_page: int,
    ):
        """
        Возвращает объект пагинации SQLAlchemy для комментариев поста.
        Сортировка: сначала старые (хронологический порядок).
        """
        return (
            Comment.query
            .filter_by(post_id=post_id)
            .order_by(Comment.created_at.asc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

    # ── Запись ────────────────────────────────────────────────────────────────

    @staticmethod
    def create(post_id: int, user_id: int, content: str) -> Comment:
        comment = Comment(
            post_id=post_id,
            user_id=user_id,
            content=content.strip(),
        )
        db.session.add(comment)
        return comment

    @staticmethod
    def update_content(comment: Comment, new_content: str) -> Comment:
        comment.content = new_content.strip()
        return comment

    @staticmethod
    def delete(comment: Comment) -> None:
        db.session.delete(comment)
