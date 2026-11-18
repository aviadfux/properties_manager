"""Tests run against a real PostgreSQL (the `pm_test` database), because the rules being tested —
row-level security, constraints, permissions of the database role — live in the database.

All data here is invented.
"""

import os
import time
import uuid

import pyotp
import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

OWNER_URL = os.environ.get("TEST_MIGRATION_DATABASE_URL", "postgresql+psycopg://pm_owner:pm_local_dev@localhost:5432/pm_test")
APP_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://pm_app:pm_local_app@localhost:5432/pm_test")

# Set before the application is imported; never the development database or its keys.
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=APP_URL,
    MIGRATION_DATABASE_URL=OWNER_URL,
    FIELD_ENCRYPTION_KEYS=Fernet.generate_key().decode(),
    BLIND_INDEX_KEY="test-only-key",
)

from fastapi.testclient import TestClient  # noqa: E402

from app import cli  # noqa: E402
from app.auth import service  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.models import Membership, Organization, Role, User  # noqa: E402
from app.db.session import owner_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.security.passwords import hash_password  # noqa: E402

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)  # hashing is slow on purpose: once for all tests


@pytest.fixture(scope="session", autouse=True)
def database():
    """An empty `pm_test` database, built by the real migrations."""
    url = make_url(OWNER_URL)
    assert url.database and "test" in url.database, "tests only run against a test database"
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        if not conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}).scalar():
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()
    with owner_engine().begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    cli.cmd_setup(None)


@pytest.fixture(autouse=True)
def clean_tables(database):
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with owner_engine().begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} CASCADE"))


@pytest.fixture
def clock(monkeypatch):
    """One-time codes work once per 30 seconds; each sign-in in a test moves the clock one step on."""
    state = {"now": time.time()}
    monkeypatch.setattr(service, "_clock", lambda: state["now"])
    return state


class Person:
    def __init__(self, user: User, organization_id: uuid.UUID, secret: str | None, clock: dict):
        self.id, self.email, self.organization_id, self.secret, self._clock = user.id, user.email, organization_id, secret, clock

    def code(self) -> str:
        self._clock["now"] += 30
        return pyotp.TOTP(self.secret).at(self._clock["now"])

    def sign_in(self) -> TestClient:
        client = TestClient(app)
        r = client.post("/api/auth/login", json={"email": self.email, "password": PASSWORD, "code": self.code()})
        assert r.status_code == 200, r.text
        return client


@pytest.fixture
def make_org():
    def make(name: str = "Org") -> uuid.UUID:
        with Session(owner_engine()) as db, db.begin():
            org = Organization(name=name)
            db.add(org)
            db.flush()
            return org.id

    return make


@pytest.fixture
def make_person(clock):
    def make(organization_id: uuid.UUID, role: Role = Role.managing_director, *, with_2fa: bool = True) -> Person:
        secret = pyotp.random_base32() if with_2fa else None
        with Session(owner_engine(), expire_on_commit=False) as db, db.begin():
            user = User(
                email=f"user-{uuid.uuid4().hex[:8]}@example.com",
                name="Test User",
                password_hash=PASSWORD_HASH,
                totp_secret=secret,
                totp_enabled=with_2fa,
            )
            db.add(user)
            db.flush()
            db.add(Membership(organization_id=organization_id, user_id=user.id, role=role))
        return Person(user, organization_id, secret, clock)

    return make


@pytest.fixture
def anonymous() -> TestClient:
    return TestClient(app)


CUSTOMER = {"kind": "individual", "name": "Dana Example", "taxId": "123456782", "phone": "+972500000001", "email": "Dana@Example.com"}
PROPERTY = {"kind": "apartment", "address": "1 Sample St", "city": "Sampletown", "unit": "4"}
