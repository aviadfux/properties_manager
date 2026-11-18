"""The audit log: who did what, and when (spec §8). One helper, so every entry has the same shape."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditEvent


def record(
    db: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    """`detail` holds field names and non-personal values only — never a name, ID number or free text."""
    db.add(
        AuditEvent(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=detail,
        )
    )
