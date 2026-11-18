"""Human numbers per organization: customer #12, property #7 (docs/DATA_MODEL.md)."""

import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import Counter


def next_number(db: Session, organization_id: uuid.UUID, name: str) -> int:
    """Safe when two people save at the same moment: the database hands out each number once."""
    stmt = (
        insert(Counter)
        .values(organization_id=organization_id, name=name, value=1)
        .on_conflict_do_update(index_elements=["organization_id", "name"], set_={"value": Counter.value + 1})
        .returning(Counter.value)
    )
    return db.execute(stmt).scalar_one()
