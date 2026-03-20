"""
services/comment_service.py
───────────────────────────
Бизнес-логика для комментариев.
Никаких прямых запросов к БД — только через CommentRepository.
"""
from __future__ import annotations

from typing import Optional

from models import db, Comment, Post
from repositories.comment_repository import CommentRepository
from utils import get_avatar_url


# ── Сериализация ──────────────────────────────────────────────────────────────

def comment_to_dict(comment: Comment, viewer_id: Optional[int] = None) -> dict:
    """Преобразовать Comment в JSON-совместимый dict."""
    author = comment.user
    return {
        'id':         comment.id,
        'content':    comment.content,
        'created_at': comment.created_at.isoformat(),
        'updated_at': comment.updated_at.isoformat() if comment.updated_at else None,
        'post_id':    comment.post_id,
        'author': {
            'id':       str(author.id),
            'username': author.username,
            'avatar':   get_avatar_url(author),
        },
        'is_own': (viewer_id is not None and comment.user_id == viewer_id),
    }


# ── Бизнес-операции ───────────────────────────────────────────────────────────

class CommentService:

    # ── Список ────────────────────────────────────────────────────────────────

    @staticmethod
    def list_for_post(
        post_id: int,
        page: int,
        per_page: int,
        viewer_id: Optional[int],
    ) -> tuple[list[dict], dict]:
        """
        Вернуть (список комментариев, meta).
        meta содержит page, per_page, total, has_more.
        """
        post = db.session.get(Post, post_id)
        if post is None:
            raise ValueError('Пост не найден')

        pagination = CommentRepository.get_paginated_for_post(post_id, page, per_page)
        items = [comment_to_dict(c, viewer_id) for c in pagination.items]
        meta = {
            'page':     page,
            'per_page': per_page,
            'total':    pagination.total,
            'has_more': pagination.has_next,
        }
        return items, meta

    # ── Создание ──────────────────────────────────────────────────────────────

    @staticmethod
    def create(post_id: int, user_id: int, content: str) -> Comment:
        """
        Создать комментарий.
        Raises:
            ValueError: пост не найден.
        """
        post = db.session.get(Post, post_id)
        if post is None:
            raise ValueError('Пост не найден')

        comment = CommentRepository.create(post_id, user_id, content)
        db.session.commit()
        return comment

    # ── Редактирование ────────────────────────────────────────────────────────

    @staticmethod
    def update(
        comment_id: int,
        user_id: int,
        new_content: str,
    ) -> Comment:
        """
        Обновить содержимое комментария.
        Raises:
            LookupError:    комментарий не найден.
            PermissionError: не автор.
        """
        comment = CommentRepository.get_by_id(comment_id)
        if comment is None:
            raise LookupError('Комментарий не найден')
        if comment.user_id != user_id:
            raise PermissionError('Нет прав на редактирование этого комментария')

        CommentRepository.update_content(comment, new_content)
        db.session.commit()
        return comment

    # ── Удаление ──────────────────────────────────────────────────────────────

    @staticmethod
    def delete(comment_id: int, user_id: int) -> None:
        """
        Удалить комментарий.
        Raises:
            LookupError:     комментарий не найден.
            PermissionError: не автор.
        """
        comment = CommentRepository.get_by_id(comment_id)
        if comment is None:
            raise LookupError('Комментарий не найден')
        if comment.user_id != user_id:
            raise PermissionError('Нет прав на удаление этого комментария')

        CommentRepository.delete(comment)
        db.session.commit()
