"""Spec §10 #15: one organization can never see or change another's data — enforced by the database."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.db.base import Base
from app.db.rls import APP_ROLE, IDENTITY_TABLES
from app.db.session import org_transaction, owner_engine, transaction
from tests.conftest import CUSTOMER, PROPERTY


@pytest.fixture
def two_orgs(make_org, make_person):
    a, b = make_person(make_org("A")), make_person(make_org("B"))
    return a, b


def test_api_never_shows_another_organizations_rows(two_orgs):
    a, b = two_orgs
    customer = a.sign_in().post("/api/customers", json=CUSTOMER).json()

    other = b.sign_in()
    assert other.get("/api/customers").json() == []
    assert other.get(f"/api/customers/{customer['id']}").status_code == 404
    assert other.post(f"/api/customers/{customer['id']}/reveal-tax-id").status_code == 404
    assert len(a.sign_in().get("/api/customers").json()) == 1


def test_database_filters_even_when_the_code_does_not(two_orgs):
    a, b = two_orgs
    a.sign_in().post("/api/customers", json=CUSTOMER)
    everything = text("SELECT count(*) FROM customers")  # no WHERE: what a forgotten filter looks like

    with org_transaction(a.organization_id) as db:
        assert db.scalar(everything) == 1
    with org_transaction(b.organization_id) as db:
        assert db.scalar(everything) == 0
    with transaction() as db:  # nobody said which organization: nothing is visible
        assert db.scalar(everything) == 0


def test_database_refuses_writing_into_another_organization(two_orgs):
    a, b = two_orgs
    customer = a.sign_in().post("/api/customers", json=CUSTOMER).json()

    with pytest.raises(DBAPIError, match="row-level security"), org_transaction(b.organization_id) as db:
        db.execute(
            text(
                "INSERT INTO customers (id, organization_id, number, kind, name, phone, preferred_language, preferred_channel, status) "
                "VALUES (gen_random_uuid(), :org, 99, 'individual', 'X', '+972500000009', 'he', 'whatsapp', 'active')"
            ),
            {"org": a.organization_id},
        )
    with org_transaction(b.organization_id) as db:  # changing or deleting A's row from B touches nothing
        assert db.execute(text("UPDATE customers SET name = 'X' WHERE id = :id"), {"id": customer["id"]}).rowcount == 0
        assert db.execute(text("DELETE FROM customers WHERE id = :id"), {"id": customer["id"]}).rowcount == 0


def test_a_row_cannot_point_to_another_organizations_row(two_orgs):
    a, b = two_orgs
    building = a.sign_in().post("/api/properties", json={**PROPERTY, "kind": "building", "unit": None}).json()

    assert b.sign_in().post("/api/properties", json={**PROPERTY, "parentId": building["id"]}).status_code == 422
    # Even the table owner cannot create such a link: the foreign key includes the organization.
    with pytest.raises(IntegrityError), owner_engine().begin() as conn:
        conn.execute(
            text(
                "INSERT INTO properties (id, organization_id, number, kind, parent_id, address, city) "
                "VALUES (gen_random_uuid(), :org, 99, 'apartment', :parent, 'x', 'y')"
            ),
            {"org": b.organization_id, "parent": building["id"]},
        )


def test_every_table_with_customer_data_is_protected():
    """Fails when a new table is added without row-level security."""
    with owner_engine().connect() as conn:
        secured = {r[0] for r in conn.execute(text("SELECT relname FROM pg_class WHERE relrowsecurity AND relkind = 'r'"))}
        policies = {r[0] for r in conn.execute(text("SELECT tablename FROM pg_policies WHERE policyname = 'organization_isolation'"))}
    for table in Base.metadata.sorted_tables:
        if table.name in IDENTITY_TABLES:
            continue
        assert table.name == "organizations" or "organization_id" in table.c, f"{table.name} has no organization_id"
        assert table.name in secured and table.name in policies, f"{table.name} has no row-level security"


def test_the_api_role_cannot_bypass_the_rules():
    with owner_engine().connect() as conn:
        role = conn.execute(text("SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = :r"), {"r": APP_ROLE}).one()
        owned = conn.execute(text("SELECT count(*) FROM pg_tables WHERE tableowner = :r"), {"r": APP_ROLE}).scalar()
    assert tuple(role) == (False, False, False, False)
    assert owned == 0


def test_audit_log_is_append_only(two_orgs):
    a, _ = two_orgs
    a.sign_in()  # signing in writes an audit event
    with org_transaction(a.organization_id) as db:
        assert db.scalar(text("SELECT count(*) FROM audit_events")) >= 1
    for statement in ("UPDATE audit_events SET action = 'x'", "DELETE FROM audit_events"):
        with pytest.raises(DBAPIError, match="permission denied"), org_transaction(a.organization_id) as db:
            db.execute(text(statement))
