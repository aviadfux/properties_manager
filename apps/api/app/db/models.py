"""Database tables. Entities and rules: docs/DATA_MODEL.md.

Two groups:
- Identity tables (users, sessions, login_attempts) are read before the organization is known, at
  sign-in. They hold no customer data and have no row-level security.
- Everything else belongs to an organization and is protected by row-level security (app/db/rls.py).
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, OrgRow, Timestamps, enum_column, org_fk
from app.security.crypto import EncryptedString

# ---------- enums ----------


class Language(enum.StrEnum):
    he = "he"
    en = "en"


class PartyKind(enum.StrEnum):
    individual = "individual"
    company = "company"


class Channel(enum.StrEnum):
    whatsapp = "whatsapp"
    email = "email"
    phone = "phone"


class CustomerStatus(enum.StrEnum):
    active = "active"
    inactive = "inactive"


class PropertyKind(enum.StrEnum):
    complex = "complex"
    building = "building"
    apartment = "apartment"
    office = "office"
    shop = "shop"
    commercial = "commercial"
    parking = "parking"
    storage = "storage"
    other = "other"


class Role(enum.StrEnum):
    managing_director = "managing_director"
    property_manager = "property_manager"
    operations = "operations"
    finance = "finance"
    accountant = "accountant"


# ---------- organizations and identity ----------


class Organization(Timestamps, Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    default_language: Mapped[Language] = mapped_column(enum_column(Language), default=Language.he)
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Jerusalem")


class User(Timestamps, Base):
    """A person who signs in. Which organization they work in, and as what, is a Membership."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)  # lower-case
    name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(255))
    totp_secret: Mapped[str | None] = mapped_column(EncryptedString(255))
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # The last 30-second step a code was accepted for: the same code cannot be used twice.
    totp_last_step: Mapped[int | None] = mapped_column(BigInteger)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Membership(OrgRow, Base):
    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[Role] = mapped_column(enum_column(Role))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    @classmethod
    def __extra_args__(cls) -> tuple:
        return (UniqueConstraint("organization_id", "user_id"),)


class AuthSession(Base):
    """A signed-in browser. The cookie holds a random token; only its hash is stored here."""

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    # False until the one-time code was checked; such a session can only set up 2FA.
    mfa_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginAttempt(Base):
    """Failed sign-ins, for rate limiting. `key` is a keyed fingerprint of the email or the address — never the value."""

    __tablename__ = "login_attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(64))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_login_attempts_key_at", "key", "at"),)


# ---------- cross-cutting ----------


class Counter(Base):
    """The next human number per organization (customer #12, issue #1042)."""

    __tablename__ = "counters"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), primary_key=True)
    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)


class AuditEvent(Base):
    """Append-only: the API's database role may insert and read, never change or delete (spec §8)."""

    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64))  # e.g. "customer.create", "customer.reveal_tax_id"
    entity_type: Mapped[str | None] = mapped_column(String(32))
    entity_id: Mapped[uuid.UUID | None] = mapped_column()
    # Field names and non-personal values only — never a name, ID number, phone or free text.
    detail: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


# ---------- customers, properties, tenants ----------


class Customer(OrgRow, Base):
    __tablename__ = "customers"

    number: Mapped[int] = mapped_column(Integer)
    kind: Mapped[PartyKind] = mapped_column(enum_column(PartyKind))
    name: Mapped[str] = mapped_column(String(200))
    tax_id: Mapped[str | None] = mapped_column(EncryptedString(255))  # identifier: encrypted at rest
    tax_id_index: Mapped[str | None] = mapped_column(String(64))  # fingerprint of the digits, for duplicates
    phone: Mapped[str] = mapped_column(String(20))  # E.164
    email: Mapped[str | None] = mapped_column(String(320))  # lower-case
    billing_address: Mapped[str | None] = mapped_column(String(300))
    preferred_language: Mapped[Language] = mapped_column(enum_column(Language), default=Language.he)
    preferred_channel: Mapped[Channel] = mapped_column(enum_column(Channel), default=Channel.whatsapp)
    status: Mapped[CustomerStatus] = mapped_column(enum_column(CustomerStatus), default=CustomerStatus.active)
    notes: Mapped[str | None] = mapped_column(Text)

    @classmethod
    def __extra_args__(cls) -> tuple:
        return (UniqueConstraint("organization_id", "number"), Index("ix_customers_tax_id_index", "organization_id", "tax_id_index"))


class Property(OrgRow, Base):
    __tablename__ = "properties"

    number: Mapped[int] = mapped_column(Integer)
    kind: Mapped[PropertyKind] = mapped_column(enum_column(PropertyKind))
    parent_id: Mapped[uuid.UUID | None] = mapped_column()  # the property this one is part of
    address: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str | None] = mapped_column(String(20))
    floor: Mapped[int | None] = mapped_column(Integer)
    area_sqm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    rooms: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    block: Mapped[str | None] = mapped_column(String(20))  # גוש
    parcel: Mapped[str | None] = mapped_column(String(20))  # חלקה
    notes: Mapped[str | None] = mapped_column(Text)

    @classmethod
    def __extra_args__(cls) -> tuple:
        return (
            UniqueConstraint("organization_id", "number"),
            org_fk("parent_id", "properties"),
            CheckConstraint("parent_id <> id", name="not_own_parent"),
            Index("ix_properties_parent_id", "parent_id"),
        )


class Ownership(OrgRow, Base):
    __tablename__ = "ownerships"

    customer_id: Mapped[uuid.UUID] = mapped_column(index=True)
    property_id: Mapped[uuid.UUID] = mapped_column(index=True)
    share_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal(100))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)  # empty = current

    @classmethod
    def __extra_args__(cls) -> tuple:
        return (
            org_fk("customer_id", "customers"),
            org_fk("property_id", "properties"),
            CheckConstraint("share_percent > 0 AND share_percent <= 100", name="share_range"),
            CheckConstraint("end_date IS NULL OR end_date >= start_date", name="dates_in_order"),
        )


class Tenant(OrgRow, Base):
    __tablename__ = "tenants"

    number: Mapped[int] = mapped_column(Integer)
    kind: Mapped[PartyKind] = mapped_column(enum_column(PartyKind))
    name: Mapped[str] = mapped_column(String(200))
    tax_id: Mapped[str | None] = mapped_column(EncryptedString(255))
    tax_id_index: Mapped[str | None] = mapped_column(String(64))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(320))
    preferred_language: Mapped[Language] = mapped_column(enum_column(Language), default=Language.he)
    notes: Mapped[str | None] = mapped_column(Text)

    @classmethod
    def __extra_args__(cls) -> tuple:
        return (UniqueConstraint("organization_id", "number"),)


class Lease(OrgRow, Base):
    __tablename__ = "leases"

    property_id: Mapped[uuid.UUID] = mapped_column(index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    monthly_rent_minor: Mapped[int] = mapped_column(BigInteger)  # agorot, never a float
    currency: Mapped[str] = mapped_column(String(3), default="ILS")

    @classmethod
    def __extra_args__(cls) -> tuple:
        return (
            org_fk("property_id", "properties"),
            org_fk("tenant_id", "tenants"),
            CheckConstraint("end_date >= start_date", name="dates_in_order"),
            CheckConstraint("monthly_rent_minor >= 0", name="rent_not_negative"),
        )
