"""add comments and reactions

Revision ID: a1b2c3d4e5f6
Revises: 32c9dee1a30b
Create Date: 2026-03-20 12:00:00.000000

Создаёт таблицы:
  - comment  (id, content, created_at, updated_at, post_id, user_id)
  - reaction (id, reaction_type, created_at, post_id, user_id)
              + UniqueConstraint (post_id, user_id, reaction_type)

Индексы:
  - ix_comment_post_id, ix_comment_user_id, ix_comment_created_at
  - ix_reaction_post_id, ix_reaction_user_id
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '32c9dee1a30b'   # ← замените на реальный последний revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── comment ───────────────────────────────────────────────────────────────
    op.create_table(
        'comment',
        sa.Column('id',         sa.Integer(),  nullable=False),
        sa.Column('content',    sa.Text(),     nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('post_id',    sa.Integer(),  nullable=False),
        sa.Column('user_id',    sa.Integer(),  nullable=False),

        sa.PrimaryKeyConstraint('id', name='pk_comment'),

        sa.ForeignKeyConstraint(
            ['post_id'], ['post.id'],
            name='fk_comment_post_id_post',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'], ['user.id'],
            name='fk_comment_user_id_user',
            ondelete='CASCADE',
        ),
    )
    op.create_index('ix_comment_post_id',    'comment', ['post_id'])
    op.create_index('ix_comment_user_id',    'comment', ['user_id'])
    op.create_index('ix_comment_created_at', 'comment', ['created_at'])

    # ── reaction ──────────────────────────────────────────────────────────────
    reaction_type_enum = sa.Enum(
        'like', 'love', 'laugh', 'sad', 'wow', 'fire',
        name='reactiontypeenum',
    )

    op.create_table(
        'reaction',
        sa.Column('id',            sa.Integer(),         nullable=False),
        sa.Column('reaction_type', reaction_type_enum,   nullable=False),
        sa.Column('created_at',    sa.DateTime(),        nullable=False),
        sa.Column('post_id',       sa.Integer(),         nullable=False),
        sa.Column('user_id',       sa.Integer(),         nullable=False),

        sa.PrimaryKeyConstraint('id', name='pk_reaction'),

        sa.ForeignKeyConstraint(
            ['post_id'], ['post.id'],
            name='fk_reaction_post_id_post',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'], ['user.id'],
            name='fk_reaction_user_id_user',
            ondelete='CASCADE',
        ),
        sa.UniqueConstraint(
            'post_id', 'user_id', 'reaction_type',
            name='uq_reaction_post_user_type',
        ),
    )
    op.create_index('ix_reaction_post_id', 'reaction', ['post_id'])
    op.create_index('ix_reaction_user_id', 'reaction', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_reaction_user_id', table_name='reaction')
    op.drop_index('ix_reaction_post_id', table_name='reaction')
    op.drop_table('reaction')

    # Удаляем тип enum (нужно для PostgreSQL; SQLite игнорирует)
    sa.Enum(name='reactiontypeenum').drop(op.get_bind(), checkfirst=True)

    op.drop_index('ix_comment_created_at', table_name='comment')
    op.drop_index('ix_comment_user_id',    table_name='comment')
    op.drop_index('ix_comment_post_id',    table_name='comment')
    op.drop_table('comment')
