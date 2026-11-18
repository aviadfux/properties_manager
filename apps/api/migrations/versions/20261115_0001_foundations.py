"""Foundations: organizations, users and sessions, audit log, customers, properties, tenants — and
row-level security on everything that belongs to an organization.

Revision: 0001
Previous: -
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.db import rls

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

NOW = sa.text("now()")


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def choice(table: str, name: str, *values: str) -> sa.Enum:
    """Text limited to the given values by a CHECK constraint."""
    return sa.Enum(*values, name=op.f(f"ck_{table}_{name}"), native_enum=False, create_constraint=True, length=32)


def org_table(name: str, *items: sa.schema.SchemaItem) -> None:
    """A table whose rows belong to an organization: id, organization_id, timestamps, and
    (organization_id, id) unique so that other tables can only point to rows of the same organization."""
    op.create_table(
        name,
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        *items,
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name=f"pk_{name}"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=f"fk_{name}_organization_id_organizations"),
        sa.UniqueConstraint("organization_id", "id", name=f"uq_{name}_organization_id_id"),
    )
    op.create_index(f"ix_{name}_organization_id", name, ["organization_id"])


def same_org_fk(table: str, column: str, target: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["organization_id", column], [f"{target}.organization_id", f"{target}.id"], name=f"fk_{table}_organization_id_{column}_{target}"
    )


LANGUAGES = ("he", "en")
PARTY_KINDS = ("individual", "company")
ROLES = ("managing_director", "property_manager", "operations", "finance", "accountant")
PROPERTY_KINDS = ("complex", "building", "apartment", "office", "shop", "commercial", "parking", "storage", "other")

PROTECTED = ["organizations", "memberships", "counters", "audit_events", "customers", "properties", "ownerships", "tenants", "leases"]
IDENTITY = ["users", "sessions", "login_attempts"]


def upgrade() -> None:
    # ---------- organizations and identity ----------
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("default_language", choice("organizations", "language", *LANGUAGES), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("totp_secret", sa.String(255), nullable=True),  # encrypted by the application
        sa.Column("totp_enabled", sa.Boolean(), nullable=False),
        sa.Column("totp_last_step", sa.BigInteger(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    org_table(
        "memberships",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", choice("memberships", "role", *ROLES), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_memberships_user_id_users"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_memberships_organization_id_user_id"),
    )
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("mfa_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_sessions_user_id_users"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_sessions_organization_id_organizations"),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_login_attempts"),
    )
    op.create_index("ix_login_attempts_key_at", "login_attempts", ["key", "at"])

    # ---------- cross-cutting ----------
    op.create_table(
        "counters",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(32), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("organization_id", "name", name="pk_counters"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_counters_organization_id_organizations"),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("detail", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_audit_events"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_audit_events_organization_id_organizations"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name="fk_audit_events_actor_user_id_users"),
    )
    op.create_index("ix_audit_events_organization_id", "audit_events", ["organization_id"])

    # ---------- customers, properties, tenants ----------
    org_table(
        "customers",
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("kind", choice("customers", "partykind", *PARTY_KINDS), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("tax_id", sa.String(255), nullable=True),  # encrypted by the application
        sa.Column("tax_id_index", sa.String(64), nullable=True),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("billing_address", sa.String(300), nullable=True),
        sa.Column("preferred_language", choice("customers", "language", *LANGUAGES), nullable=False),
        sa.Column("preferred_channel", choice("customers", "channel", "whatsapp", "email", "phone"), nullable=False),
        sa.Column("status", choice("customers", "customerstatus", "active", "inactive"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("organization_id", "number", name="uq_customers_organization_id_number"),
    )
    op.create_index("ix_customers_tax_id_index", "customers", ["organization_id", "tax_id_index"])
    org_table(
        "properties",
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("kind", choice("properties", "propertykind", *PROPERTY_KINDS), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("address", sa.String(200), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("floor", sa.Integer(), nullable=True),
        sa.Column("area_sqm", sa.Numeric(8, 2), nullable=True),
        sa.Column("rooms", sa.Numeric(4, 1), nullable=True),
        sa.Column("block", sa.String(20), nullable=True),
        sa.Column("parcel", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("organization_id", "number", name="uq_properties_organization_id_number"),
        same_org_fk("properties", "parent_id", "properties"),
        sa.CheckConstraint("parent_id <> id", name=op.f("ck_properties_not_own_parent")),
    )
    op.create_index("ix_properties_parent_id", "properties", ["parent_id"])
    org_table(
        "ownerships",
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("share_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        same_org_fk("ownerships", "customer_id", "customers"),
        same_org_fk("ownerships", "property_id", "properties"),
        sa.CheckConstraint("share_percent > 0 AND share_percent <= 100", name=op.f("ck_ownerships_share_range")),
        sa.CheckConstraint("end_date IS NULL OR end_date >= start_date", name=op.f("ck_ownerships_dates_in_order")),
    )
    op.create_index("ix_ownerships_customer_id", "ownerships", ["customer_id"])
    op.create_index("ix_ownerships_property_id", "ownerships", ["property_id"])
    org_table(
        "tenants",
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("kind", choice("tenants", "partykind", *PARTY_KINDS), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("tax_id", sa.String(255), nullable=True),  # encrypted by the application
        sa.Column("tax_id_index", sa.String(64), nullable=True),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("preferred_language", choice("tenants", "language", *LANGUAGES), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("organization_id", "number", name="uq_tenants_organization_id_number"),
    )
    org_table(
        "leases",
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("monthly_rent_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        same_org_fk("leases", "property_id", "properties"),
        same_org_fk("leases", "tenant_id", "tenants"),
        sa.CheckConstraint("end_date >= start_date", name=op.f("ck_leases_dates_in_order")),
        sa.CheckConstraint("monthly_rent_minor >= 0", name=op.f("ck_leases_rent_not_negative")),
    )
    op.create_index("ix_leases_property_id", "leases", ["property_id"])
    op.create_index("ix_leases_tenant_id", "leases", ["tenant_id"])

    # ---------- the API's database role, and row-level security ----------
    # pm_app does not own the tables, so the policies below apply to it. Its password is set by
    # `python -m app.cli setup`, from DATABASE_URL — never written in a migration.
    op.execute(
        f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{rls.APP_ROLE}') THEN
                CREATE ROLE {rls.APP_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
            END IF;
        END $$
        """
    )
    op.execute(f"GRANT USAGE ON SCHEMA public TO {rls.APP_ROLE}")
    for table in PROTECTED:
        for statement in rls.enable_rls_sql(table):
            op.execute(statement)
    for table in PROTECTED + IDENTITY:
        for statement in rls.grants_sql(table):
            op.execute(statement)


def downgrade() -> None:
    for table in [
        "leases",
        "tenants",
        "ownerships",
        "properties",
        "customers",
        "audit_events",
        "counters",
        "login_attempts",
        "sessions",
        "memberships",
        "users",
        "organizations",
    ]:
        op.drop_table(table)
