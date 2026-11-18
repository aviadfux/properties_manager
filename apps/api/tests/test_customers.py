"""Customers and properties: identifiers, permissions, numbering, validation."""

from decimal import Decimal

from sqlalchemy import text

from app.db.models import Role
from app.db.session import owner_engine
from tests.conftest import CUSTOMER, PROPERTY


def test_tax_id_is_encrypted_masked_and_revealed_on_record(make_org, make_person):
    client = make_person(make_org()).sign_in()
    created = client.post("/api/customers", json=CUSTOMER)
    assert created.status_code == 201
    customer = created.json()

    assert customer["taxIdMasked"] == "•••••6782" and "taxId" not in customer
    assert customer["email"] == "dana@example.com" and customer["number"] == 1
    assert CUSTOMER["taxId"] not in client.get("/api/customers").text

    with owner_engine().connect() as conn:  # what is actually in the database
        stored, index = conn.execute(text("SELECT tax_id, tax_id_index FROM customers")).one()
    assert CUSTOMER["taxId"] not in stored and CUSTOMER["taxId"] not in index

    assert client.post(f"/api/customers/{customer['id']}/reveal-tax-id").json() == {"taxId": CUSTOMER["taxId"]}
    with owner_engine().connect() as conn:
        events = conn.execute(text("SELECT action, detail FROM audit_events WHERE entity_id = :id ORDER BY at"), {"id": customer["id"]}).all()
    assert [e.action for e in events] == ["customer.create", "customer.reveal_tax_id"]
    assert all(e.detail is None for e in events)  # the log says what happened, not the values


def test_roles_are_checked_on_the_server(make_org, make_person):
    org = make_org()
    customer = make_person(org).sign_in().post("/api/customers", json=CUSTOMER).json()

    for role in (Role.operations, Role.accountant):
        client = make_person(org, role).sign_in()
        assert client.get("/api/customers").status_code == 200
        assert client.post("/api/customers", json=CUSTOMER).json() == {"detail": "not_allowed"}
        assert client.post("/api/properties", json=PROPERTY).status_code == 403
        assert client.post(f"/api/customers/{customer['id']}/reveal-tax-id").status_code == 403


def test_numbers_count_per_organization(make_org, make_person):
    a, b = make_person(make_org()).sign_in(), make_person(make_org()).sign_in()
    assert [a.post("/api/customers", json=CUSTOMER).json()["number"] for _ in range(3)] == [1, 2, 3]
    assert b.post("/api/customers", json=CUSTOMER).json()["number"] == 1
    assert a.post("/api/properties", json=PROPERTY).json()["number"] == 1


def test_properties_nest(make_org, make_person):
    client = make_person(make_org()).sign_in()
    building = client.post("/api/properties", json={**PROPERTY, "kind": "building", "unit": None}).json()
    unit = client.post("/api/properties", json={**PROPERTY, "parentId": building["id"], "areaSqm": "72.5", "rooms": "3.5"}).json()
    assert unit["parentId"] == building["id"] and Decimal(unit["areaSqm"]) == Decimal("72.5")
    assert [p["number"] for p in client.get("/api/properties").json()] == [1, 2]


def test_bad_input_is_refused(make_org, make_person):
    client = make_person(make_org()).sign_in()
    for change in ({"phone": "050-0000001"}, {"email": "not-an-email"}, {"name": ""}, {"kind": "alien"}):
        assert client.post("/api/customers", json={**CUSTOMER, **change}).status_code == 422
    assert client.get("/api/customers").json() == []


def test_security_headers(anonymous):
    r = anonymous.get("/api/health")
    assert r.json() == {"status": "ok"}
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
