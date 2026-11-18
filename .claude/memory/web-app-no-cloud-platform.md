---
name: web-app-no-cloud-platform
description: The customer works from a phone and a PC browser; no Azure or Kubernetes, but PostgreSQL stays
metadata:
  type: project
---

Decided 2026-11-15: the customer will use the system from a smartphone and a PC browser. So: one responsive web app at one address, installable to the phone's home screen (PWA); no app-store apps; no Azure, no Kubernetes. The database stays PostgreSQL. Hosting: one small managed service (Render / Railway / Fly.io, EU region) for the API + worker, with managed PostgreSQL and daily backups (docs/BUILD_PLAN.md §1–2).

**Why:** user said "my customer wants to work from his smartphone and pc browser, so we don't need to work with azure or kubernetes, but we still should work with database like postgre".
**How to apply:** every admin screen must work at phone width; don't propose container orchestration or a big cloud platform. Related: [[build-team-and-plan]], [[user-python]].
