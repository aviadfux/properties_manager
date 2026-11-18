"""Sign-in: password, then a one-time code (2FA), then a session cookie (spec §8, §9).

Rules:
- A wrong email and a wrong password give the same answer and take the same time.
- After several failures for the same email or from the same address, sign-in is refused for a while.
- Internal users must use 2FA. Until it is set up, the session can do one thing: set it up.
- A one-time code works once.
- A removed user is locked out on their very next request: every request re-checks the user and the membership.
"""

import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app import audit
from app.config import get_settings
from app.db.models import AuthSession, LoginAttempt, Membership, Role, User
from app.db.session import set_context, transaction
from app.security import crypto, passwords


class AuthError(Exception):
    def __init__(self, code: str, status: int = 401) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


@dataclass
class Identity:
    """Who is making this request. Built from the session cookie on every request."""

    user: User
    organization_id: uuid.UUID
    role: Role
    session: AuthSession


def _now() -> datetime:
    return datetime.now(UTC)


_clock = time.time  # the time one-time codes are checked against; tests move it forward


# ---------- rate limiting ----------


def _throttle_keys(email: str, ip: str) -> list[str]:
    return [crypto.blind_index(f"login-email:{email}"), crypto.blind_index(f"login-ip:{ip}")]


def _check_throttle(db: Session, keys: list[str]) -> None:
    s = get_settings()
    since = _now() - timedelta(minutes=s.login_window_minutes)
    for key in keys:
        failures = db.scalar(select(func.count()).select_from(LoginAttempt).where(LoginAttempt.key == key, LoginAttempt.at > since))
        if (failures or 0) >= s.login_max_failures:
            raise AuthError("too_many_attempts", status=429)


def _record_failure(keys: list[str]) -> None:
    # In its own transaction: the request's transaction is rolled back when sign-in fails.
    with transaction() as db:
        db.add_all([LoginAttempt(key=key) for key in keys])


# ---------- one-time codes ----------


def _accept_totp(user: User, code: str) -> bool:
    if not user.totp_secret:
        return False
    step = passwords.matching_totp_step(user.totp_secret, code, _clock())
    if step is None or (user.totp_last_step is not None and step <= user.totp_last_step):
        return False
    user.totp_last_step = step
    return True


# ---------- sign-in and sessions ----------


def _new_session(db: Session, user: User, organization_id: uuid.UUID, mfa_verified: bool) -> str:
    token = crypto.new_token()
    db.add(
        AuthSession(
            token_hash=crypto.token_hash(token),
            user_id=user.id,
            organization_id=organization_id,
            mfa_verified=mfa_verified,
            expires_at=_now() + timedelta(days=get_settings().session_max_days),
        )
    )
    return token


def login(db: Session, *, email: str, password: str, code: str | None, ip: str) -> tuple[str, User, bool]:
    """Returns (session token, user, whether 2FA still has to be set up). Raises AuthError."""
    email = email.strip().lower()
    keys = _throttle_keys(email, ip)
    _check_throttle(db, keys)

    user = db.scalar(select(User).where(User.email == email))
    password_ok = passwords.verify_password(user.password_hash if user else None, password)
    if not (user and password_ok and user.active):
        _record_failure(keys)
        raise AuthError("invalid_credentials")

    set_context(db, user_id=user.id)
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.active).order_by(Membership.created_at))
    if not membership:
        _record_failure(keys)
        raise AuthError("invalid_credentials")

    if user.totp_enabled:
        if not code:
            raise AuthError("code_required")
        if not _accept_totp(user, code):
            _record_failure(keys)
            raise AuthError("invalid_code")

    if passwords.needs_rehash(user.password_hash):
        user.password_hash = passwords.hash_password(password)

    set_context(db, organization_id=membership.organization_id, user_id=user.id)
    token = _new_session(db, user, membership.organization_id, mfa_verified=user.totp_enabled)
    db.execute(delete(LoginAttempt).where(LoginAttempt.key == keys[0]))
    audit.record(db, organization_id=membership.organization_id, actor_user_id=user.id, action="auth.login")
    return token, user, not user.totp_enabled


def identify(db: Session, token: str | None) -> Identity:
    """The user behind a session cookie; also tells the database which organization this transaction is for."""
    if not token:
        raise AuthError("not_signed_in")
    s = get_settings()
    now = _now()
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == crypto.token_hash(token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
            AuthSession.last_seen_at > now - timedelta(minutes=s.session_idle_minutes),
        )
    )
    user = db.get(User, session.user_id) if session else None
    if not (session and user and user.active):
        raise AuthError("not_signed_in")

    set_context(db, organization_id=session.organization_id, user_id=user.id)
    membership = db.scalar(
        select(Membership).where(Membership.user_id == user.id, Membership.organization_id == session.organization_id, Membership.active)
    )
    if not membership:
        raise AuthError("not_signed_in")

    if session.last_seen_at < now - timedelta(minutes=1):
        session.last_seen_at = now
    return Identity(user=user, organization_id=session.organization_id, role=membership.role, session=session)


def logout(db: Session, identity: Identity) -> None:
    identity.session.revoked_at = _now()
    audit.record(db, organization_id=identity.organization_id, actor_user_id=identity.user.id, action="auth.logout")


def revoke_all_sessions(db: Session, user_id: uuid.UUID) -> None:
    db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)).values(revoked_at=_now()))


# ---------- setting up 2FA ----------


def start_totp_setup(identity: Identity) -> tuple[str, str]:
    """A new secret for the authenticator app. Nothing is switched on until a code from it is confirmed."""
    user = identity.user
    if user.totp_enabled:
        raise AuthError("already_set_up", status=409)
    secret = passwords.new_totp_secret()
    user.totp_secret = secret
    return secret, passwords.totp_uri(secret, user.email, get_settings().totp_issuer)


def confirm_totp_setup(db: Session, identity: Identity, code: str) -> str:
    """Switches 2FA on and returns a fresh session token (the old one stops working)."""
    user = identity.user
    if user.totp_enabled:
        raise AuthError("already_set_up", status=409)
    if not _accept_totp(user, code):
        raise AuthError("invalid_code", status=400)
    user.totp_enabled = True
    identity.session.revoked_at = _now()
    token = _new_session(db, user, identity.organization_id, mfa_verified=True)
    audit.record(db, organization_id=identity.organization_id, actor_user_id=user.id, action="auth.totp_enabled")
    return token
