"""Building blocks shared by every table (docs/DATA_MODEL.md, "Principles")."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, ForeignKeyConstraint, MetaData, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

# Fixed names for indexes and constraints, so migrations are the same on every machine.
NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class OrgRow(Timestamps):
    """A row that belongs to one organization. Row-level security filters on `organization_id`."""

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), index=True)

    @declared_attr.directive
    def __table_args__(cls) -> tuple:  # noqa: N805
        # (organization_id, id) is what other tables point to: see org_fk below.
        return (UniqueConstraint("organization_id", "id"), *cls.__extra_args__())

    @classmethod
    def __extra_args__(cls) -> tuple:
        return ()


def org_fk(column: str, table: str) -> ForeignKeyConstraint:
    """A link to a row of the *same organization*.

    The database checks links without row-level security, so a plain foreign key would accept the id
    of another organization's row. Pointing at (organization_id, id) makes that impossible.
    """
    return ForeignKeyConstraint(["organization_id", column], [f"{table}.organization_id", f"{table}.id"])


def enum_column(values: type[enum.StrEnum]) -> Enum:
    """Stored as text with a CHECK constraint: adding a value later is an ordinary migration."""
    return Enum(
        values,
        name=values.__name__.lower(),  # names the CHECK constraint: ck_<table>_<name>
        native_enum=False,
        create_constraint=True,
        values_callable=lambda e: [m.value for m in e],
        length=32,
    )
