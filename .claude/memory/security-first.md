---
name: security-first
description: User requires strict security and privacy; never send personal data to AI models (including Claude itself); rules in docs/SECURITY.md and the data-security skill
metadata:
  type: feedback
---

On 2026-11-06 the user said security is "very important to implement all safety" and "if we work with ai model we shouldn't upload sensitive data", and asked for a Claude skill about security and sensitivity.

**Why:** the system holds owners' and tenants' personal data (IDs, bank details, signed agreements); the repo is public; Israel's Privacy Protection Law applies.
**How to apply:** follow `.claude/skills/data-security/SKILL.md` and `docs/SECURITY.md`. Never read real customer documents (Read on private/, docx, pdf, xlsx, .env is denied in `.claude/settings.json`). Ask the user to run `npm --prefix apps/admin run redact -- <file>` and read only the redacted copy. Any AI feature goes through `redact()` in `apps/admin/src/security/sensitive.ts`. Test data stays invented (example.com emails). Related: [[no-whatsapp-integration]], [[generic-product-single-company]], [[github-remote]].
