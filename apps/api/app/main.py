"""The API application. Run locally with:  uv run uvicorn app.main:app --reload"""

from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.auth.router import router as auth_router
from app.config import get_settings
from app.db.session import transaction
from app.routers.customers import router as customers_router
from app.routers.properties import router as properties_router

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def create_app() -> FastAPI:
    settings = get_settings()
    # The interactive API pages are for development; production serves only the API itself.
    docs = {"docs_url": "/api/docs", "openapi_url": "/api/openapi.json"} if settings.is_local else {"docs_url": None, "openapi_url": None}
    app = FastAPI(title="Property Management API", redoc_url=None, **docs)

    @app.middleware("http")
    async def security(request: Request, call_next) -> Response:
        # A browser says where a request comes from (Origin). A change coming from another site is
        # refused, on top of the cookie's SameSite=Strict.
        origin = request.headers.get("origin")
        if request.method not in SAFE_METHODS and origin and urlparse(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "cross_site_request"}, status_code=403)

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"  # cannot be embedded in another site
        response.headers["Cache-Control"] = "no-store"  # personal data is never kept in a browser or proxy cache
        if settings.cookie_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @app.exception_handler(IntegrityError)
    async def conflict(request: Request, exc: IntegrityError) -> JSONResponse:
        # A database rule refused the change. The details may contain personal data: they are not returned.
        return JSONResponse({"detail": "conflict"}, status_code=409)

    @app.get("/api/health", tags=["system"])
    def health() -> dict[str, str]:
        with transaction() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(customers_router)
    app.include_router(properties_router)
    return app


app = create_app()
