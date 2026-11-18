from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.deps import Ctx, get_db, session_ctx
from app.config import get_settings
from app.schemas import CodeIn, LoginIn, Me, TotpSetup

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.session_cookie,
        token,
        max_age=s.session_max_days * 86_400,
        httponly=True,  # scripts in the page cannot read it
        secure=s.cookie_secure,  # HTTPS only (off on http://localhost)
        samesite="strict",  # never sent with requests coming from another site
        path="/",
    )


def _me(ctx: Ctx) -> Me:
    i = ctx.identity
    return Me(name=i.user.name, email=i.user.email, role=i.role, organization_id=i.organization_id, mfa_setup_required=not i.session.mfa_verified)


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> Me:
    ip = request.client.host if request.client else "unknown"
    try:
        token, user, setup_required = service.login(db, email=body.email, password=body.password, code=body.code, ip=ip)
    except service.AuthError as e:
        raise HTTPException(e.status, e.code) from None
    _set_cookie(response, token)
    identity = service.identify(db, token)
    return Me(name=user.name, email=user.email, role=identity.role, organization_id=identity.organization_id, mfa_setup_required=setup_required)


@router.post("/logout", status_code=204)
def logout(response: Response, ctx: Ctx = Depends(session_ctx)) -> None:
    service.logout(ctx.db, ctx.identity)
    response.delete_cookie(get_settings().session_cookie, path="/")


@router.get("/me")
def me(ctx: Ctx = Depends(session_ctx)) -> Me:
    return _me(ctx)


@router.post("/totp/setup")
def totp_setup(ctx: Ctx = Depends(session_ctx)) -> TotpSetup:
    """Step 1: a secret to add to an authenticator app (shown as a QR code by the screen)."""
    try:
        secret, uri = service.start_totp_setup(ctx.identity)
    except service.AuthError as e:
        raise HTTPException(e.status, e.code) from None
    return TotpSetup(secret=secret, uri=uri)


@router.post("/totp/confirm")
def totp_confirm(body: CodeIn, response: Response, ctx: Ctx = Depends(session_ctx)) -> Me:
    """Step 2: a code from the app proves it was added; 2FA is on from here."""
    try:
        token = service.confirm_totp_setup(ctx.db, ctx.identity, body.code)
    except service.AuthError as e:
        raise HTTPException(e.status, e.code) from None
    _set_cookie(response, token)
    return _me(ctx).model_copy(update={"mfa_setup_required": False})
