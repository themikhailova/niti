"""
services/reaction_service.py
────────────────────────────
Бизнес-логика для реакций.
Toggle: если реакция уже есть — удаляем, иначе — создаём.
"""
from __future__ import annotations

from typing import Optional

from models import db, Post, ReactionTypeEnum, REACTION_EMOJI_MAP
from repositories.reaction_repository import ReactionRepository
from utils import get_avatar_url


# ── Сериализация ──────────────────────────────────────────────────────────────

def reaction_counts_to_dict(counts: dict[str, int]) -> list[dict]:
    """
    Преобразует {type: count} → список объектов с emoji-меткой.
    Всегда возвращает все типы реакций.
    """
    return [
        {
            'type':  rtype,
            'emoji': REACTION_EMOJI_MAP[rtype],
            'count': count,
        }
        for rtype, count in counts.items()
    ]


# ── Бизнес-операции ───────────────────────────────────────────────────────────

class ReactionService:

    # ── Toggle ────────────────────────────────────────────────────────────────

    @staticmethod
    def toggle(
        post_id: int,
        user_id: int,
        reaction_type_str: str,
    ) -> tuple[bool, dict[str, int]]:
        """
        Поставить или убрать реакцию (toggle).

        Returns:
            (added, counts) — added=True если реакция добавлена,
                              False если удалена.
                              counts — актуальные счётчики после операции.
        Raises:
            ValueError:    пост не найден или неверный тип реакции.
        """
        # Валидация типа реакции
        try:
            reaction_type = ReactionTypeEnum(reaction_type_str)
        except ValueError:
            valid = ', '.join(t.value for t in ReactionTypeEnum)
            raise ValueError(
                f'Неверный тип реакции «{reaction_type_str}». '
                f'Допустимые значения: {valid}'
            )

        # Проверка поста
        post = db.session.get(Post, post_id)
        if post is None:
            raise LookupError('Пост не найден')

        existing = ReactionRepository.find(post_id, user_id, reaction_type)

        if existing:
            ReactionRepository.delete(existing)
            db.session.commit()
            added = False
        else:
            ReactionRepository.create(post_id, user_id, reaction_type)
            db.session.commit()
            added = True

        counts = ReactionRepository.counts_for_post(post_id)
        return added, counts

    # ── Статистика ────────────────────────────────────────────────────────────

    @staticmethod
    def get_counts(post_id: int) -> list[dict]:
        """
        Вернуть статистику реакций для поста.
        Raises:
            LookupError: пост не найден.
        """
        post = db.session.get(Post, post_id)
        if post is None:
            raise LookupError('Пост не найден')

        counts = ReactionRepository.counts_for_post(post_id)
        return reaction_counts_to_dict(counts)

    # ── Пользователи реакции (опционально) ───────────────────────────────────

    @staticmethod
    def get_users_for_reaction(
        post_id: int,
        reaction_type_str: str,
    ) -> list[dict]:
        """
        Список пользователей, поставивших заданную реакцию.
        Raises:
            ValueError:  неверный тип реакции.
            LookupError: пост не найден.
        """
        try:
            reaction_type = ReactionTypeEnum(reaction_type_str)
        except ValueError:
            valid = ', '.join(t.value for t in ReactionTypeEnum)
            raise ValueError(
                f'Неверный тип реакции. Допустимые значения: {valid}'
            )

        post = db.session.get(Post, post_id)
        if post is None:
            raise LookupError('Пост не найден')

        reactions = ReactionRepository.users_for_reaction(post_id, reaction_type)
        return [
            {
                'id':       str(r.user.id),
                'username': r.user.username,
                'avatar':   get_avatar_url(r.user),
                'reacted_at': r.created_at.isoformat(),
            }
            for r in reactions
        ]
