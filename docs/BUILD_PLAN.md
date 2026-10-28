# Build Plan — Property Management System

Source of truth for requirements: [`SPEC.en.md`](SPEC.en.md) (Hebrew translation: [`SPEC.he.md`](SPEC.he.md)), v1.5. Entities: [`DATA_MODEL.md`](DATA_MODEL.md).
Section references (§) below point to the spec.

## 1. Guiding decisions

| Decision | Choice |
|---|---|
| Product shape | Generic, multi-organization ready; one organization at launch (§1) |
| Team | The user + Claude, working in this repository |
| Launch scope | §11 launch version: ~10 properties, one internal user, fixed and percentage fees, payment requests, manual transfer verification, invoicing-provider integration |
| Money | Integer minor units (agorot / cents), never floats; currency per organization (§9) |
| Financial records | Append-only: corrections are new entries, never edits or deletes (§5) |
| Isolation | Every table has `organization_id`; enforced in the database with row-level security, not only in code (§1, §8) |

## 2. Proposed stack

Python where the business rules live, TypeScript only for the screens. The user works in Python, so billing, approvals, integrations and jobs — the parts that must be right — are in the language they can read and maintain; Next.js is used for what it does best: a fast, accessible, right-to-left web UI.

| Layer | Choice | Why |
|---|---|---|
| Public website | Next.js (App Router) + React + TypeScript, static export | SEO-friendly static pages (§2) |
| Admin app | React + Vite + TypeScript single-page app, React Router, TanStack Query | Talks only to the Python API; no Node server; hosted as static files (§3) |
| UI kit | Tailwind CSS + shadcn/ui, logical CSS properties | Good RTL support; mobile-responsive (§9) |
| i18n | Translation files per language, Hebrew + English from day one | Strings never hard-coded (§9) |
| API | Python: FastAPI + Pydantic | All business logic and permissions server-side (§8) |
| Database | PostgreSQL + SQLAlchemy 2 + Alembic migrations | Relational, transactions, row-level security |
| Auth | In the API: password + TOTP 2FA, invitations, organization roles; secure HTTP-only session cookies | MFA for internal users, invite-only tenant access (§8, §9) |
| Jobs | Procrastinate (task queue inside Postgres) + a separate worker process | Monthly billing runs, reminders, provider sync, WhatsApp, retries — no Redis (§9) |
| Files | S3-compatible storage (e.g., Cloudflare R2) with short-lived signed URLs | Private files, time-limited links (§9) |
| Email | Transactional email provider (e.g., Postmark / Resend) | Payment requests and reminders (§5) |
| Tests | pytest (domain logic, API) + Playwright (end-to-end) + axe (accessibility) | Acceptance scenarios §10 become automated tests |
| Hosting | Website: static hosting (Vercel / Cloudflare Pages). App: web + API + worker on Render / Fly.io / Railway, managed Postgres with daily backups and point-in-time recovery; EU region | Low ops; RPO 24h / RTO 1 business day (§9) |
| Monitoring | Sentry + business alerts from the worker | Technical + business monitoring (§9) |

The API publishes an OpenAPI schema; the web app generates its TypeScript client from it, so the two sides never drift.

## 3. Architecture outline

```
apps/web      Next.js: public website (later also the tenant portal)
apps/admin    React + Vite: manager / employee app — dashboard, to-do, customers, properties, tenants, issues, team inbox
apps/api      FastAPI: REST API, auth, webhooks (invoicing provider, WhatsApp)
apps/api/core Pure domain logic (pricing, charge generation, allocation, approvals) — no I/O, fully unit-tested
apps/api/db   SQLAlchemy models, Alembic migrations, RLS policies, seed data
apps/api/integrations  Invoicing provider client (morning first), WhatsApp, email, storage
apps/worker   Procrastinate tasks: billing run, reminders, provider outbox, reconciliation, WhatsApp conversations (same Python package as the API)
```

Key patterns:
- **Organization context**: each request sets `app.organization_id` on the DB session; RLS policies filter every table.
- **Billing idempotency**: unique key `(agreement_id, service_period, charge_type)` — a re-run cannot create a second charge (§4).
- **Outbox for external calls**: document issuance is written to an `integration_outbox` row in the same transaction as the verification, then the worker calls the provider with a stable idempotency key; failures go to an exceptions queue (§5, §9).
- **Versioned prices**: `billing_plan_versions` with `effective_from`; price changes and indexation add a version (§4).
- **Approval as data**: approvals store approver, authority (normal / backup / emergency), amount, scope and quote version; a changed quote invalidates the approval (§7).
- **Audit log**: one append-only `audit_events` table written by a shared helper for every financial, permission and approval action (§8).

## 4. Core data model (first cut)

- Tenancy & users: `organizations`, `organization_settings`, `users`, `memberships(role)`, `approval_delegations`
- CRM: `contacts`, `clients`, `leads`, `lead_activities`, `tasks`
- Property: `buildings`, `units`, `unit_ownerships(from,to)`, `occupancies(from,to)`
- Contracts: `management_agreements`, `billing_plan_versions`, `leases`, `lease_options`, `guarantees`
- Billing: `charges`, `payment_requests`, `payments`, `payment_allocations`, `credit_balances`, `reminder_schedules`
- Documents: `files`, `document_links`, `issued_documents` (provider number + status), `integration_outbox`, `exceptions`
- Maintenance: `vendors`, `vendor_documents(expiry)`, `service_requests`, `quotes`, `approvals`, `work_orders`, `owner_consents`
- Later: `building_ledgers`, `budgets`, `budget_versions`, `cheques`, `bank_statement_lines`, `messages`, `insurance_policies`
- Cross-cutting: `audit_events`, `calendar_items` (view over expiries and deadlines)

## 5. Phases

Each phase ends with a demo and the relevant §10 acceptance scenarios passing as automated tests.

### Phase 0a — Public website (≈1 week)
Next.js static site in `apps/web`, Hebrew (RTL) + English, company details from one settings file, contact by phone, WhatsApp link and a form that opens a pre-filled WhatsApp chat; accessibility statement and privacy policy (§2 "Public Website").
*Exit*: deployed on a preview URL; §10 #21 passes; real content approved.

### Phase 0b — Admin screens with sample data (≈1 week)
`apps/admin`: app shell (sidebar, search, language switch), dashboard with the "Needs attention" strip, To-do page, customers / properties / tenants / issues lists and cards (spec §3). Data comes from a sample-data module behind the same functions the real API client will implement, typed from `docs/DATA_MODEL.md`.
*Exit*: the user clicks through all views and approves the screens and the data model.

### Phase 0 — Foundations (≈1–2 weeks)
Repo, CI, environments (local / staging / production), auth with 2FA, organizations and roles, RLS, i18n + RTL shell, audit log, file storage, error monitoring, deployment pipeline.
*Exit*: a user logs in with 2FA in Hebrew or English; the cross-organization isolation test (§10 #15) passes.

### Phase 1 — Operational core (≈2–3 weeks)
Customers, properties, ownerships and tenants over time, issues (lifecycle, assignment, history — without quotes and approvals), leads pipeline with conversion, management agreements, leases (with options, guarantees), vendors, documents, tasks, global search, client and property cards, glossary-aligned naming.
*Exit*: the 10 real properties can be entered by hand.

### Phase 2 — Billing engine (≈2–3 weeks)
Billing plans and versions (fixed, percentage with explicit basis, add-on), partial-month and vacancy rules, monthly preview, idempotent charge generation, payment requests by email, manual payment entry with proof, verification, allocation, partial payments and credit balances, reminders, collections dashboard.
*Exit*: §10 scenarios #1, #2, #7 pass; one month is billed in staging.

### Phase 3 — Invoicing-provider integration (≈1–2 weeks)
Sandbox account, client matching, "Verify receipt and issue document", outbox + retries + exceptions queue, linking documents issued directly in the provider, daily reconciliation.
*Exit*: §10 #3, #4 pass against the sandbox.

### Phase 4 — Maintenance and approvals (≈2 weeks)
Quotes, approval card, re-approval on change, vendor document expiry blocking, owner-consent thresholds, emergency path and backup approver (configured but dormant while there is one user).
*Exit*: §10 #5, #11, #12, #14 pass.

### Phase 5 — Import, hardening and pilot (≈1–2 weeks)
Opening-data import with dry run and duplicate detection, backup restore drill, permission tests, performance check, privacy documents (database definition, retention), pilot criteria of §11.
*Exit*: §10 #6, #9, #10 pass; pilot go-live.

### After launch (each priced, specified and tested separately)
1. Tenant portal (requests, documents, payment requests, proof upload)
2. Bank statement import and accountant export + read-only accountant role
3. Cheques; then card payments and standing orders via a chosen provider
4. Indexation, late fees, payment plans
5. Employees and roles in production use; separation of duties for receipt verification
6. Buildings module: ledgers, HOA budgets, allocation rules, building dashboard (before the first building)
7. Leasing pipeline, lease lifecycle checklists (inspections, utility transfers)
8. Communication hub (templates, SMS, consent) and the WhatsApp intake bot (§8): service requests, new inquiries, request status, handoff to the team inbox. A good candidate to move earlier, right after the tenant portal or instead of it, since tenants use WhatsApp more readily than a portal
9. AI assistance (request triage, invoice / proof extraction, reply drafts)

Estimates assume part-time work by the user with Claude writing most of the code; they are for sequencing, not commitments.

## 6. Before writing code

- [ ] Confirm the stack above (or name preferences)
- [ ] Hosting budget and region; domain name
- [ ] morning account: plan level with API access, sandbox credentials
- [ ] Email sending domain
- [ ] Sample (anonymized) data for the 10 properties and their agreements
- [ ] Decisions from spec §10 "Decisions Still Required" that block Phase 2: percentage-fee basis, partial-month and vacancy policy
- [ ] `git init` and a private GitHub repository
