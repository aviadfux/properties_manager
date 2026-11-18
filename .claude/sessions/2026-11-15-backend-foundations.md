# Session 2026-11-15 → 11-18: backend foundations (`apps/api`)

## What was asked

1. The customer wants to work from a smartphone and a PC browser: no Azure or Kubernetes, but keep PostgreSQL. How to continue?
2. Then: build the backend (Phase 0 — Foundations in docs/BUILD_PLAN.md).
3. Finally: the first machine cannot run Docker, so prepare the repo to continue on a second machine, and push.

## Decisions

- Phone + PC browser = one responsive web app, installable as a PWA. No app-store apps. No Azure, no Kubernetes. Recorded in docs/BUILD_PLAN.md §1.
- Hosting stays as planned: one small managed service (Render / Railway / Fly.io, EU region) + managed PostgreSQL with daily backups. Not yet chosen.
- Local PostgreSQL through Docker (`apps/api/compose.yaml`), or a native PostgreSQL 17 install.

## What was built (`apps/api`, Python 3.13, uv)

| Part | Where |
|---|---|
| Tables: organizations, users, memberships, sessions, login_attempts, counters, audit_events, customers, properties, ownerships, tenants, leases | `app/db/models.py`, migration `migrations/versions/20261115_0001_foundations.py` |
| Row-level security per organization; API connects as `pm_app` (owns nothing, no BYPASSRLS); links between rows include `organization_id` so they cannot cross organizations | `app/db/rls.py`, `app/db/base.py` (`org_fk`), `app/db/session.py` |
| Sign-in: Argon2 password + TOTP 2FA (required; first sign-in sets it up), HTTP-only SameSite=Strict session cookie (only its hash stored), rate limit 5 failures / 15 min per email and per IP, one-time codes work once, idle 1 day / max 14 days, deactivated user or membership locked out on the next request | `app/auth/` |
| Roles → permissions, checked on the server | `app/permissions.py` |
| Tax IDs encrypted (Fernet, key rotation), keyed fingerprint for duplicates, masked in responses, reveal endpoint written to the audit log | `app/security/crypto.py`, `app/routers/customers.py` |
| Endpoints: `/api/auth/*`, `/api/customers`, `/api/properties`, `/api/health` | `app/routers/`, `app/main.py` |
| Security headers, refuse cross-site changes (Origin check), no-store caching, DB errors not leaked | `app/main.py` |
| Admin command line: init-env, setup, create-org, create-user, set-password, reset-2fa, deactivate-user | `app/cli.py` |
| Tests (23): isolation (spec §10 #15), sign-in rules, customers/properties | `tests/` |
| CI job: ruff, pip-audit, pytest against a PostgreSQL service | `.github/workflows/ci.yml` |

## Verification status — IMPORTANT

**The code has never been run against a database.** On the first machine, Docker Desktop did not start and Python's compiled libraries were refused by macOS ("code signature not valid"), so no test, migration or server was run.

Checked so far: Python syntax compiles; `ruff check` passes; `ruff format` applied.

Expect fixes on the first run, most likely in:
- the hand-written migration `20261115_0001_foundations.py` vs. the models (column types, constraint names) — compare with `uv run alembic check` after `setup`;
- `tests/conftest.py` (database creation, clock fixture for one-time codes);
- `app/auth/service.py` `login()` → `identify()` call order inside the login endpoint.

## Next steps on the second machine

```bash
git pull
cd apps/api
docker compose up -d          # or a native PostgreSQL 17 with superuser pm_owner / pm_local_dev, db pm_dev
uv sync
uv run python -m app.cli init-env
uv run python -m app.cli setup
uv run alembic check          # models and migration agree
uv run pytest                 # creates and uses a separate pm_test database
```

Then, in order:
1. Make all tests pass; push so the CI `api` job runs.
2. Connect the manager app: sign-in + 2FA set-up screens, `apps/admin/src/data/api.ts` calls the API (Vite dev proxy `/api` → `localhost:8000`), types generated from `/api/openapi.json`.
3. Phone pass over every admin screen; PWA manifest + icons.
4. Choose a host and deploy staging with fake data, so the customer can try it on their phone.
5. Still open from Phase 0: file storage, error monitoring, the Python port of `redact()`.

## Open items for the user (docs/BUILD_PLAN.md §6)

Host and budget, domain name, invoicing-provider sandbox, email sending domain, the billing decisions (percentage-fee basis, partial-month and vacancy policy).
