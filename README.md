# Property Management System

A management system for property management companies: clients and leads, properties and buildings, agreements, recurring billing, payment requests and documents, maintenance with expense approvals, and a tenant portal. Built as a generic multi-organization product, deployed first for a single company.

## Repository layout

| Path | Contents |
|---|---|
| `docs/SPEC.en.md` | Specification — English (source language) |
| `docs/SPEC.he.md` | Specification — Hebrew (translation of the English) |
| `docs/BUILD_PLAN.md` | Stack, architecture and phased build plan |
| `apps/web/` | Public website (Next.js, static, Hebrew + English) |

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
