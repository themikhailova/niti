"""
migration_add_post_kind.py

Добавляет поля post_kind и original_post_id в таблицу post для SQLite.
Исправлено для твоей версии SQLAlchemy.
"""

from sqlalchemy import text
from models import db


def column_exists(conn, table_name: str, column_name: str) -> bool:
    """Проверяет, существует ли колонка в таблице (работает в SQLite)."""
    result = conn.execute(
        text("SELECT name FROM pragma_table_info(:table_name) WHERE name = :column_name"),
        {"table_name": table_name, "column_name": column_name}
    )
    return result.fetchone() is not None


def run():
    with db.engine.connect() as conn:
        # Проверяем существование столбца
        if column_exists(conn, 'post', 'post_kind'):
            print("✅ Столбец post_kind уже существует — миграция пропущена.")
            return

        print("➕ Добавляем столбцы post_kind и original_post_id...")

        conn.execute(text("ALTER TABLE post ADD COLUMN post_kind VARCHAR(10)"))

        conn.execute(text(
            "ALTER TABLE post ADD COLUMN original_post_id INTEGER "
            "REFERENCES post(id) ON DELETE SET NULL"
        ))

        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_post_original_post_id ON post (original_post_id)"
        ))

        conn.commit()
        print("🎉 Миграция успешно выполнена!")


if __name__ == '__main__':
    from app import app
    with app.app_context():
        run()