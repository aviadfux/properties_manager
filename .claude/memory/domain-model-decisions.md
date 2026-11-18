---
name: domain-model-decisions
description: User's domain rules — customer = property owner; tenant and property are separate entities; issues link to property + customer
metadata:
  type: project
---

Decided with the user on 2026-10-28 (see docs/DATA_MODEL.md):
- **Customer** = the property owner who contracts with the company. Tenants are NOT customers.
- **Tenant** and **Property** are separate entities. Tenant ↔ property via Lease (dated); property ↔ customer via Ownership (dated, supports co-owners). A customer's tenants are derived, never stored on the customer.
- **Issue** links to property (required), customer (snapshot at opening), reporter, assignee.
- Manager navigates between entity views (customers ↔ issues ↔ properties ↔ tenants).
- Dashboard = key figures + a "Needs attention" strip sorted by urgency, plus a full To-do page (user chose this over a layout toggle).

**Why:** user explicitly asked to "keep on right software design" — one fact in one place, history kept.
**How to apply:** keep apps/admin types, sample data and the future SQLAlchemy models aligned with docs/DATA_MODEL.md; don't add direct customer→tenant links. Related: [[build-team-and-plan]], [[user-python]].
