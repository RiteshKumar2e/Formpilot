"""Additive schema upgrades for databases created by earlier versions.

`create_all` creates missing tables but never adds columns to existing ones. Columns added since the
first release are listed here and added on startup when missing. They are all nullable, so existing
rows stay valid.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "profile_choices": {"updated_at": "DATETIME"},
}


def upgrade(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
