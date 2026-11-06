# Property Management System

A management system for property management companies: clients and leads, properties and buildings, agreements, recurring billing, payment requests and documents, maintenance with expense approvals, and a tenant portal. Built as a generic multi-organization product, deployed first for a single company.

## Repository layout

| Path | Contents |
|---|---|
| `docs/SPEC.en.md` | Specification — English (source language) |
| `docs/SPEC.he.md` | Specification — Hebrew (translation of the English) |
| `docs/BUILD_PLAN.md` | Stack, architecture and phased build plan |
| `apps/web/` | Public website (Next.js, static, Hebrew + English) |
| `apps/admin/` | Manager app (React + Vite), currently on sample data |
| `docs/DATA_MODEL.md` | Entities and relationships shared by the screens and the backend |

## Updating the specification

English is the source. Every change goes into both `SPEC.en.md` and `SPEC.he.md`, in the same place, so the two files keep the same headings, tables and numbering.

## Public website (`apps/web`)

Company details (name, phone, service area) are in `apps/web/site.config.ts`; all texts are in `apps/web/content/he.ts` and `apps/web/content/en.ts`.

```bash
cd apps/web
npm install
npm run dev     # http://localhost:3000 (Hebrew), http://localhost:3000/en/ (English)
npm run build   # static site in apps/web/out/
```

## Manager app (`apps/admin`)

Dashboard, to-do list, customers, properties (nested: complex › building › units), tenants, issues, professionals, payment requests with reminders, and form templates. Until the Python API exists, data comes from `src/data/sample.ts` through `src/data/api.ts` — the only module that will change when the backend is connected.

```bash
cd apps/admin
npm install
npm run dev     # http://localhost:5174 — add ?lang=en for English
npm run build   # type-check + static build in apps/admin/dist/
npm test        # all tests once (Vitest)
npm run test:watch  # re-runs the affected tests on every save
```

### Tests

Run `npm test` before every commit; CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every push and pull request. The clock is frozen at 2026-11-05 in tests (`src/test/setup.ts`), so results that depend on "today" are repeatable.

| File | Covers |
|---|---|
| `src/data/sample.test.ts` | Sample data obeys the database rules: valid references, no hierarchy cycles, ownership shares sum to 100 |
| `src/data/templates.test.ts` | Template placeholders, line markers, field labels in both languages, no typos in sample templates |
| `src/data/api.test.ts` | Business rules: inherited ownership, occupancy, history, professional coverage and suggestions, form values, the reminder job |
| `src/app.test.tsx` | Every page renders (English and Hebrew), and the main actions work: assign a professional, generate a form, send by WhatsApp, search |

`api.test.ts` describes the behaviour the Python API must reproduce; when the backend arrives, the same cases become its pytest suite.
