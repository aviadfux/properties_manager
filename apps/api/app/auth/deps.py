"""What an endpoint asks for: a database transaction, the signed-in user, a permission."""

from collections.abc import Callable, Iterator
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import service
from app.config import get_settings
from app.db.session import transaction
from app.permissions import Permission, allowed


def get_db() -> Iterator[Session]:
    """One transaction per request: committed when the request succeeds, rolled back when it fails."""
    with transaction() as db:
        yield db


@dataclass
class Ctx:
    """Everything an endpoint needs. `db` already knows the organization: row-level security is on."""

    db: Session
    identity: service.Identity

    @property
    def organization_id(self):
        return self.identity.organization_id

    @property
    def user(self):
        return self.identity.user


def session_ctx(request: Request, db: Session = Depends(get_db)) -> Ctx:
    """Signed in with a password; 2FA may still be missing. Only the 2FA set-up endpoints use this directly."""
    try:
        identity = service.identify(db, request.cookies.get(get_settings().session_cookie))
    except service.AuthError as e:
        raise HTTPException(e.status, e.code) from None
    return Ctx(db=db, identity=identity)


def current_ctx(ctx: Ctx = Depends(session_ctx)) -> Ctx:
    """Fully signed in: password and one-time code."""
    if not ctx.identity.session.mfa_verified:
        raise HTTPException(403, "mfa_setup_required")
    return ctx


def require(permission: Permission) -> Callable[[Ctx], Ctx]:
    def check(ctx: Ctx = Depends(current_ctx)) -> Ctx:
        if not allowed(ctx.identity.role, permission):
            raise HTTPException(403, "not_allowed")
        return ctx

    return check
