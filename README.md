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
| `docs/SECURITY.md` | Personal data, AI use, and the security rules for the code and the team |
| `.claude/` | Claude Code settings for this repo: the `data-security` skill, and a block on reading real documents |

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

Dashboard, to-do list, customers, properties (nested: complex › building › units), tenants, issues, professionals, payment requests with reminders, management agreements (export to print / PDF / Word, import from an existing agreement to create the customer), and form templates. Until the Python API exists, data comes from `src/data/sample.ts` through `src/data/api.ts` — the only module that will change when the backend is connected.

```bash
cd apps/admin
npm install
npm run dev     # http://localhost:5174 — add ?lang=en for English
npm run build   # type-check + static build in apps/admin/dist/
npm test        # all tests once (Vitest)
npm run test:watch  # re-runs the affected tests on every save
npm run redact -- path/to/file.docx  # a copy without personal details, safe to share
```

Security and personal data: read [docs/SECURITY.md](docs/SECURITY.md) before working with real documents or adding an AI feature.

### Tests

Run `npm test` before every commit; CI (`.github/workflows/ci.yml`) runs a dependency audit, typecheck, tests and build on every push and pull request, and scans the history for passwords and keys. The clock is frozen at 2026-11-05 in tests (`src/test/setup.ts`), so results that depend on "today" are repeatable.

| File | Covers |
|---|---|
| `src/data/sample.test.ts` | Sample data obeys the database rules: valid references, no hierarchy cycles, ownership shares sum to 100 |
| `src/data/templates.test.ts` | Template placeholders, line markers, field labels in both languages, no typos in sample templates |
| `src/data/api.test.ts` | Business rules: inherited ownership, occupancy, history, professional coverage and suggestions, form values, the reminder job, agreements (create, import, duplicates, never overwriting) |
| `src/data/agreements.test.ts` | Reading agreements: every exported sample agreement reads back exactly (Hebrew, English, through Word); free-text agreements; Word files |
| `src/data/documents.test.ts` | Opening files: Word, text encodings (UTF-8/16, Windows-1255), old `.doc`, PDF, scans, damaged and oversized files; tracked changes in Word |
| `src/data/checks.test.ts` | Every check that blocks or warns before saving, and the export check noticing any changed field |
| `src/data/roundtrip.test.ts` | 150 random customers and agreements export and import back exactly (Hebrew, English, Word), and redaction hides every detail of each |
| `src/security/sensitive.test.ts` | ID check digit, masking, and redaction: no name, ID, phone, email, address, bank or card detail survives |
| `src/app.test.tsx` | Every page renders (English and Hebrew), and the main actions work: assign a professional, generate a form, send by WhatsApp, search, import an agreement (pasted and Word), create and sign one, masked IDs |

`api.test.ts` describes the behaviour the Python API must reproduce; when the backend arrives, the same cases become its pytest suite.
