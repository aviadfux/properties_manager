"""Alembic: runs migrations as the table owner (MIGRATION_DATABASE_URL)."""

from alembic import context

from app.db import models  # noqa: F401  (registers the tables)
from app.db.base import Base
from app.db.session import owner_engine

target_metadata = Base.metadata

if context.is_offline_mode():
    raise SystemExit("Offline migrations are not supported: run against a database.")

with owner_engine().connect() as connection:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()
