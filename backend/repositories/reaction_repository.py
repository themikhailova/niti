"""
repositories/reaction_repository.py
────────────────────────────────────
Все прямые запросы к БД для Reaction.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func

from models import db, Reaction, ReactionTypeEnum


class ReactionRepository:
    """Методы доступа к таблице reaction."""

    # ── Чтение ────────────────────────────────────────────────────────────────

    @staticmethod
    def find(post_id: int, user_id: int, reaction_type: ReactionTypeEnum) -> Optional[Reaction]:
        """Найти конкретную реакцию пользователя на пост определённого типа."""
        return Reaction.query.filter_by(
            post_id=post_id,
            user_id=user_id,
            reaction_type=reaction_type,
        ).first()

    @staticmethod
    def counts_for_post(post_id: int) -> dict[str, int]:
        """
        Вернуть словарь {reaction_type: count} для поста.
        Все типы включены (даже если count == 0).
        """
        rows = (
            db.session.query(
                Reaction.reaction_type,
                func.count(Reaction.id).label('cnt'),
            )
            .filter(Reaction.post_id == post_id)
            .group_by(Reaction.reaction_type)
            .all()
        )
        # Инициализируем все типы нулями
        result = {t.value: 0 for t in ReactionTypeEnum}
        for row in rows:
            result[row.reaction_type.value] = row.cnt
        return result

    @staticmethod
    def users_for_reaction(
        post_id: int,
        reaction_type: ReactionTypeEnum,
        limit: int = 50,
    ) -> list[Reaction]:
        """Список пользователей, поставивших заданную реакцию (для детального просмотра)."""
        return (
            Reaction.query
            .filter_by(post_id=post_id, reaction_type=reaction_type)
            .order_by(Reaction.created_at.desc())
            .limit(limit)
            .all()
        )

    # ── Запись ────────────────────────────────────────────────────────────────

    @staticmethod
    def create(post_id: int, user_id: int, reaction_type: ReactionTypeEnum) -> Reaction:
        reaction = Reaction(
            post_id=post_id,
            user_id=user_id,
            reaction_type=reaction_type,
        )
        db.session.add(reaction)
        return reaction

    @staticmethod
    def delete(reaction: Reaction) -> None:
        db.session.delete(reaction)
