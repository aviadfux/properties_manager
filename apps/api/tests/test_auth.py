"""Sign-in rules (spec §8, §9): password + one-time code, rate limiting, immediate lock-out."""

from datetime import UTC, datetime, timedelta

import pyotp
from sqlalchemy import text

from app.db.models import Role
from app.db.session import owner_engine
from tests.conftest import PASSWORD


def _owner(sql: str, **params) -> None:
    with owner_engine().begin() as conn:
        conn.execute(text(sql), params)


def test_nothing_without_signing_in(anonymous):
    for path in ("/api/customers", "/api/properties", "/api/auth/me"):
        assert anonymous.get(path).status_code == 401


def test_wrong_password_and_unknown_email_look_the_same(anonymous, make_org, make_person):
    person = make_person(make_org())
    wrong = anonymous.post("/api/auth/login", json={"email": person.email, "password": "wrong password!"})
    unknown = anonymous.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert (wrong.status_code, wrong.json()) == (unknown.status_code, unknown.json()) == (401, {"detail": "invalid_credentials"})


def test_password_alone_is_not_enough(anonymous, make_org, make_person):
    person = make_person(make_org())
    login = {"email": person.email, "password": PASSWORD}

    assert anonymous.post("/api/auth/login", json=login).json() == {"detail": "code_required"}
    assert anonymous.post("/api/auth/login", json={**login, "code": "000000"}).json() == {"detail": "invalid_code"}
    assert anonymous.get("/api/customers").status_code == 401

    r = anonymous.post("/api/auth/login", json={**login, "code": person.code()})
    assert r.status_code == 200 and r.json()["mfaSetupRequired"] is False
    assert anonymous.get("/api/customers").status_code == 200


def test_session_cookie_is_protected(make_org, make_person, anonymous):
    person = make_person(make_org())
    r = anonymous.post("/api/auth/login", json={"email": person.email, "password": PASSWORD, "code": person.code()})
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    # The database holds only a hash of the token.
    with owner_engine().connect() as conn:
        stored = conn.execute(text("SELECT token_hash FROM sessions")).scalar()
    assert stored != anonymous.cookies["pm_session"]


def test_a_code_works_once(anonymous, make_org, make_person):
    person = make_person(make_org())
    login = {"email": person.email, "password": PASSWORD, "code": person.code()}
    assert anonymous.post("/api/auth/login", json=login).status_code == 200
    assert anonymous.post("/api/auth/login", json=login).json() == {"detail": "invalid_code"}


def test_first_sign_in_sets_up_2fa(anonymous, make_org, make_person, clock):
    person = make_person(make_org(), with_2fa=False)
    r = anonymous.post("/api/auth/login", json={"email": person.email, "password": PASSWORD})
    assert r.json()["mfaSetupRequired"] is True
    # Until 2FA is set up, the session opens nothing else.
    assert anonymous.get("/api/customers").json() == {"detail": "mfa_setup_required"}
    first_cookie = anonymous.cookies["pm_session"]

    secret = anonymous.post("/api/auth/totp/setup").json()["secret"]
    assert anonymous.post("/api/auth/totp/confirm", json={"code": "000000"}).status_code == 400
    assert anonymous.get("/api/customers").status_code == 403

    r = anonymous.post("/api/auth/totp/confirm", json={"code": pyotp.TOTP(secret).at(clock["now"])})
    assert r.status_code == 200 and r.json()["mfaSetupRequired"] is False
    assert anonymous.get("/api/customers").status_code == 200
    assert anonymous.cookies["pm_session"] != first_cookie  # a new session replaces the limited one

    # From now on a code is required, and the secret is not stored as readable text.
    fresh = anonymous.__class__(anonymous.app)
    assert fresh.post("/api/auth/login", json={"email": person.email, "password": PASSWORD}).json() == {"detail": "code_required"}
    with owner_engine().connect() as conn:
        assert secret not in conn.execute(text("SELECT totp_secret FROM users WHERE id = :id"), {"id": person.id}).scalar()


def test_too_many_failures_block_sign_in(anonymous, make_org, make_person):
    person = make_person(make_org())
    for _ in range(5):
        assert anonymous.post("/api/auth/login", json={"email": person.email, "password": "wrong password!"}).status_code == 401
    # Now even the right password and code are refused, until the window passes.
    r = anonymous.post("/api/auth/login", json={"email": person.email, "password": PASSWORD, "code": person.code()})
    assert (r.status_code, r.json()) == (429, {"detail": "too_many_attempts"})

    _owner("UPDATE login_attempts SET at = now() - interval '16 minutes'")
    assert anonymous.post("/api/auth/login", json={"email": person.email, "password": PASSWORD, "code": person.code()}).status_code == 200


def test_removed_user_is_locked_out_at_once(make_org, make_person):
    org = make_org()
    deactivated, removed = make_person(org), make_person(org, Role.operations)
    c1, c2 = deactivated.sign_in(), removed.sign_in()
    assert c1.get("/api/customers").status_code == c2.get("/api/customers").status_code == 200

    _owner("UPDATE users SET active = false WHERE id = :id", id=deactivated.id)
    _owner("UPDATE memberships SET active = false WHERE user_id = :id", id=removed.id)
    assert c1.get("/api/customers").status_code == 401
    assert c2.get("/api/customers").status_code == 401


def test_sessions_end(make_org, make_person):
    person = make_person(make_org())
    idle, expired, signed_out = person.sign_in(), person.sign_in(), person.sign_in()

    _owner(
        "UPDATE sessions SET last_seen_at = :t WHERE token_hash = encode(sha256(:tok), 'hex')",
        t=datetime.now(UTC) - timedelta(days=2),
        tok=idle.cookies["pm_session"].encode(),
    )
    _owner("UPDATE sessions SET expires_at = now() WHERE token_hash = encode(sha256(:tok), 'hex')", tok=expired.cookies["pm_session"].encode())
    token = signed_out.cookies["pm_session"]
    assert signed_out.post("/api/auth/logout").status_code == 204
    signed_out.cookies.set("pm_session", token)  # a copied cookie is useless after signing out

    for client in (idle, expired, signed_out):
        assert client.get("/api/auth/me").status_code == 401


def test_requests_from_another_site_are_refused(make_org, make_person):
    client = make_person(make_org()).sign_in()
    r = client.post("/api/auth/logout", headers={"Origin": "https://evil.example"})
    assert (r.status_code, r.json()) == (403, {"detail": "cross_site_request"})
    assert client.get("/api/auth/me").status_code == 200  # still signed in
