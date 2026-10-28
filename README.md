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

Dashboard, to-do list, customers, properties, tenants and issues. Until the Python API exists, data comes from `src/data/sample.ts` through `src/data/api.ts` — the only module that will change when the backend is connected.

```bash
cd apps/admin
npm install
npm run dev     # http://localhost:5174 — add ?lang=en for English
npm run build   # type-check + static build in apps/admin/dist/
```
