# Data Model

The shared contract between the admin screens (`apps/admin`, TypeScript types) and the backend (`apps/api`, SQLAlchemy models + Pydantic schemas). Requirements: [SPEC.en.md](SPEC.en.md). This file covers the entities needed for Phase 1 and the first admin screens; it grows with each phase.

## Principles

- **One fact, one place.** A relationship is stored once and derived everywhere else. A customer's tenants are derived through their properties' leases, never stored on the customer.
- **History is kept, not overwritten.** Relationships that change over time (ownership, leases) have `start_date` / `end_date`. "Current" means the row whose period contains today.
- **Snapshots where history matters.** An issue stores the customer that owned the property when it was opened, so closing or reassigning ownership later does not move old issues to the new owner.
- **Every row belongs to an organization** (`organization_id`), enforced by row-level security (spec §1, §8).
- **Money** is an integer in minor units (`amount_minor`, agorot) plus a currency code. **Dates** are calendar dates; **timestamps** are UTC and displayed in the organization's time zone.
- **IDs** are UUIDs. Records people talk about also get a short human number per organization (e.g., issue `#1042`).

Common fields on every entity: `id`, `organization_id`, `created_at`, `updated_at`.

## Diagram

```
                ┌──────────────┐
                │ Organization │
                └──────┬───────┘
                       │ (every entity)
 ┌──────────┐   ┌──────┴───────┐   ┌──────────┐   ┌──────────┐
 │ Customer │──<│  Ownership   │>──│ Property │──<│  Lease   │>──┐
 └────┬─────┘   │ start / end  │   └────┬─────┘   │start/end │   │
      │         └──────────────┘        │         └──────────┘   │
      │                                 │                   ┌────┴─────┐
      │         ┌──────────────┐        │                   │  Tenant  │
      └────────<│    Issue     │>───────┘                   └──────────┘
                │ reporter ────┼──> Customer | Tenant | User
                │ assignee ────┼──> User
                └──────┬───────┘
                       │
                ┌──────┴───────┐
                │ IssueEvent   │  (status changes, notes, attachments)
                └──────────────┘
```

`A ──< B` means one A has many B.

## Entities

### Customer
The property owner who contracts with the company for management (spec glossary: "Customer (client)").

| Field | Type | Notes |
|---|---|---|
| `number` | int | Human number per organization |
| `kind` | enum `individual` \| `company` | |
| `name` | str | Full name or company name |
| `tax_id` | str? | ID number / company number |
| `phone` | str | E.164 format |
| `email` | str? | |
| `billing_address` | str? | |
| `preferred_language` | enum `he` \| `en` | |
| `preferred_channel` | enum `whatsapp` \| `email` \| `phone` | |
| `status` | enum `active` \| `inactive` | `inactive` after offboarding |
| `notes` | text? | Internal only |

Derived: properties (current ownerships), tenants (active leases on those properties), open issues.

### Property
A managed unit: apartment, office, shop or other commercial space. Can exist without a managed building.

| Field | Type | Notes |
|---|---|---|
| `number` | int | Human number per organization |
| `kind` | enum `apartment` \| `office` \| `shop` \| `commercial` \| `other` | |
| `address` | str | Street and number |
| `city` | str | |
| `unit` | str? | Apartment / unit number |
| `floor` | int? | |
| `area_sqm` | decimal? | |
| `rooms` | decimal? | |
| `building_id` | FK? | Later phase (Buildings module) |
| `notes` | text? | |

Derived: current customer (ownership), current tenants (active leases), occupancy (`occupied` if an active lease exists, else `vacant`).

### Ownership
Links a customer to a property over time. Supports co-owners.

| Field | Type | Notes |
|---|---|---|
| `customer_id` | FK Customer | |
| `property_id` | FK Property | |
| `share_percent` | decimal | 100 for a single owner |
| `start_date` | date | |
| `end_date` | date? | Open = current |

Rule: for a property, current shares sum to 100. The **managing customer** of a property is the owner on its active management agreement; until agreements exist (Phase 1), it is the current owner with the largest share.

### Tenant
A person or business occupying a property under a lease. Separate from Customer: a tenant is not a party to the management agreement.

| Field | Type | Notes |
|---|---|---|
| `number` | int | |
| `kind` | enum `individual` \| `company` | |
| `name` | str | |
| `tax_id` | str? | |
| `phone` | str | E.164 |
| `email` | str? | |
| `preferred_language` | enum `he` \| `en` | |
| `notes` | text? | |

Derived: current properties (active leases) and, through them, their landlords (customers).

### Lease
Links a tenant to a property over time.

| Field | Type | Notes |
|---|---|---|
| `property_id` | FK Property | |
| `tenant_id` | FK Tenant | Several tenants per lease = several rows |
| `start_date` | date | |
| `end_date` | date | |
| `monthly_rent_minor` | int | Used for percentage fees (spec §4) |
| `currency` | str | `ILS` |
| `status` | enum `active` \| `ended` \| `upcoming` | Derived from dates, stored for queries |

### Issue
A service request about a property (spec §7).

| Field | Type | Notes |
|---|---|---|
| `number` | int | Shown as `#1042` |
| `property_id` | FK Property | **Required** — where the problem is |
| `customer_id` | FK Customer | Snapshot of the managing customer when opened |
| `reporter_type` | enum `customer` \| `tenant` \| `user` | |
| `reporter_id` | UUID | Points to the reporter entity |
| `assignee_id` | FK User? | Employee responsible |
| `title` | str | Short summary |
| `description` | text | |
| `category` | enum `plumbing` \| `electrical` \| `hvac` \| `structural` \| `appliances` \| `pests` \| `locks` \| `elevator` \| `cleaning` \| `other` | |
| `location` | str? | Where in the property |
| `urgency` | enum `low` \| `normal` \| `high` \| `emergency` | Verified by an employee (spec §7) |
| `status` | enum (below) | |
| `opened_at` | timestamp | |
| `closed_at` | timestamp? | |
| `resolution` | text? | Required to close |
| `actual_cost_minor` | int? | Required to close, or 0 with "no cost" |

Statuses (spec §7): `new` → `under_review` → `awaiting_quote` → `awaiting_approval` → `approved` → `scheduled` → `in_progress` → `awaiting_signoff` → `closed`; `cancelled` from any open status. Open = not `closed` / `cancelled`.

### IssueEvent
Append-only history of an issue: status changes, notes, attachments, assignment changes.

| Field | Type | Notes |
|---|---|---|
| `issue_id` | FK Issue | |
| `kind` | enum `status` \| `note` \| `attachment` \| `assignment` | |
| `actor_type` / `actor_id` | | Who did it |
| `from_status` / `to_status` | enum? | For `status` events |
| `body` | text? | Note text |
| `internal` | bool | Internal notes are never shown to tenants (spec §7) |
| `at` | timestamp | |

### User
An employee using the admin app.

| Field | Type | Notes |
|---|---|---|
| `name` | str | |
| `email` | str | Login |
| `role` | enum `managing_director` \| `property_manager` \| `operations` \| `finance` \| `accountant` | Spec §8 |
| `active` | bool | |

## Coming in later phases

Management agreement and billing plan versions (Phase 2), charges, payment requests, payments and allocations (Phase 2), quotes, approvals and work orders (Phase 4), vendors, buildings, tasks and calendar items. Until then the dashboard figures for collections and debts use sample data.
