---
name: generic-product-single-company
description: Property-management system is built generic/multi-company-ready but deployed for one company initially
metadata:
  type: project
---

Decision (2026-10-21): the property-management CRM is built as a generic product (Organization entity, per-org data isolation, company specifics as config), but initially serves only one company. No self-service signup or SaaS billing until a second company is onboarded.

**Why:** user wants a reusable product while the immediate customer is a single management company.
**How to apply:** design schema/auth with org_id scoping from day one; never hardcode company name, locale, currency, or provider credentials. Specs live in docs/SPEC.en.md / docs/SPEC.he.md, kept parallel — see [[bilingual-spec-files]].
