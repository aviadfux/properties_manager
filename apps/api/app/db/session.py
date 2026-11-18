"""Database connections, and the one place where the organization of a request is set."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session

from app.config import get_settings


@lru_cache
def app_engine() -> Engine:
    """Connects as pm_app: row-level security applies."""
    return create_engine(get_settings().database_url, pool_pre_ping=True)


@lru_cache
def owner_engine() -> Engine:
    """Connects as the table owner. Command line and migrations only."""
    url = get_settings().migration_database_url
    if not url:
        raise RuntimeError("MIGRATION_DATABASE_URL is not set")
    return create_engine(url, pool_pre_ping=True)


def set_context(db: Session, *, organization_id: uuid.UUID | None = None, user_id: uuid.UUID | None = None) -> None:
    """Tells the database who is asking, until the end of the current transaction only."""
    db.execute(
        text("SELECT set_config('app.organization_id', :org, true), set_config('app.user_id', :uid, true)"),
        {"org": str(organization_id or ""), "uid": str(user_id or "")},
    )


@contextmanager
def transaction() -> Iterator[Session]:
    """One transaction as the API role: committed at the end, rolled back on any error."""
    with Session(app_engine(), expire_on_commit=False) as db, db.begin():
        yield db


@contextmanager
def org_transaction(organization_id: uuid.UUID, user_id: uuid.UUID | None = None) -> Iterator[Session]:
    with transaction() as db:
        set_context(db, organization_id=organization_id, user_id=user_id)
        yield db
