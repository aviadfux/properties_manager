---
name: build-team-and-plan
description: The user and Claude build the system together; build plan lives in docs/BUILD_PLAN.md
metadata:
  type: project
---

Decided 2026-10-21: the user and Claude build the system themselves in this repo (no outside developer). Plan in docs/BUILD_PLAN.md: Next.js web UI + Python FastAPI backend (confirmed 2026-10-27). Done: Phase 0a website (apps/web), Phase 0b manager screens on sample data (apps/admin, React+Vite). Next: Python backend (Phase 0 foundations) replacing apps/admin/src/data/api.ts.

**Why:** user chose "you and me" for the build.
**How to apply:** check docs/BUILD_PLAN.md for current phase before starting work; keep the acceptance scenarios from spec §10 as automated tests. See [[generic-product-single-company]], [[bilingual-spec-files]].
