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
                │ professional ┼──> Professional
                └──────┬───────┘
                       │
                ┌──────┴───────┐
                │ IssueEvent   │  (status changes, notes, attachments)
                └──────────────┘
```

`A ──< B` means one A has many B. Property also has `parent_id → Property` (a unit in a building, a building in a complex). Customer ──< PaymentRequest ──< OutgoingMessage; Customer ──< ManagementAgreement >──< Property; FormTemplate is used by ReminderRule and for generated documents.

## Entities

### Customer
The property owner who contracts with the company for management (spec glossary: "Customer (client)").

| Field | Type | Notes |
|---|---|---|
| `number` | int | Human number per organization |
| `kind` | enum `individual` \| `company` | |
| `name` | str | Full name or company name |
| `tax_id` | str? | ID number / company number. **Identifier**: encrypted at rest, masked on screen ([SECURITY.md](SECURITY.md)) |
| `phone` | str | E.164 format |
| `email` | str? | |
| `billing_address` | str? | |
| `preferred_language` | enum `he` \| `en` | |
| `preferred_channel` | enum `whatsapp` \| `email` \| `phone` | |
| `status` | enum `active` \| `inactive` | `inactive` after offboarding |
| `notes` | text? | Internal only |

Derived: properties (current ownerships), tenants (active leases on those properties), open issues, agreements.

Possible duplicates (spec §2): an existing customer with the same `tax_id` (digits only), email (case-insensitive) or phone (last 9 digits) is offered before a new customer is created.

### Property
Anything the company manages: a complex, a building, an apartment, office, shop, parking space or storage room. Properties nest: a unit can be part of a building, a building part of a complex, a parking space part of a building. A unit can also exist without a managed building.

| Field | Type | Notes |
|---|---|---|
| `number` | int | Human number per organization |
| `kind` | enum `complex` \| `building` \| `apartment` \| `office` \| `shop` \| `commercial` \| `parking` \| `storage` \| `other` | `complex` and `building` usually contain others, but any property may |
| `parent_id` | FK Property? | The property this one is part of. No cycles (checked on save) |
| `address` | str | Street and number |
| `city` | str | |
| `unit` | str? | Apartment / unit number |
| `floor` | int? | |
| `area_sqm` | decimal? | |
| `rooms` | decimal? | |
| `block` / `parcel` | str? / str? | Land registry גוש / חלקה. Identify the property in agreements and powers of attorney, and match it on import (units in one building share them; the address decides) |
| `notes` | text? | |

Derived: current customer (ownership), current tenants (active leases), parts (children, recursively), occupancy. A property without parts is `occupied` if it has an active lease, else `vacant`; a property with parts is `occupied` / `partial` / `vacant` from its innermost units. Dashboard occupancy counts units without parts only. A property's issues, leases and history include those of its parts.

Address and city are stored on every property, also on units (they are prefilled from the parent when a unit is created, and may differ — a building with two entrances).

### Ownership
Links a customer to a property over time. Supports co-owners.

| Field | Type | Notes |
|---|---|---|
| `customer_id` | FK Customer | |
| `property_id` | FK Property | |
| `share_percent` | decimal | 100 for a single owner |
| `start_date` | date | |
| `end_date` | date? | Open = current |

Rule: for a property, current shares sum to 100. A property with no ownership rows of its own **inherits** the owners of its nearest ancestor that has them (a building owned as a whole: its units have no rows). A unit sold separately gets its own rows, which take precedence. The **managing customer** of a property is the owner on its active management agreement; until agreements exist (Phase 1), it is the current owner with the largest share.

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
| `professional_id` | FK Professional? | Who does the work. Must be active; suggested by trade = category and service area = property city, but any active professional may be chosen |
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
| `kind` | enum `status` \| `note` \| `attachment` \| `assignment` \| `professional` | |
| `professional_id` | FK Professional? | For `professional` events; empty = removed |
| `actor_type` / `actor_id` | | Who did it |
| `from_status` / `to_status` | enum? | For `status` events |
| `body` | text? | Note text |
| `internal` | bool | Internal notes are never shown to tenants (spec §7) |
| `at` | timestamp | |

### Professional
A plumber, electrician, contractor or other service provider who does work on issues (the spec's "vendor"). Never logs in.

| Field | Type | Notes |
|---|---|---|
| `number` | int | |
| `kind` | enum `individual` \| `company` | |
| `name` | str | Business or person name |
| `contact_name` | str? | |
| `tax_id` | str? | |
| `phone` | str | E.164 |
| `email` | str? | |
| `trades` | enum[] | Issue categories they handle |
| `service_area_ids` | FK ServiceArea[] | Regions they serve |
| `extra_cities` | str[] | Single cities served outside those regions |
| `rating` | int 1–5? | Internal |
| `active` | bool | Inactive professionals cannot be assigned |
| `notes` | text? | |

Derived: **coverage** (the cities of their regions plus the extra cities), **working now** (cities of their open jobs, busiest first), open jobs, job history and total cost (issues with this `professional_id`).

Suggestions for an issue rank active professionals by: right trade (category), coverage includes the property's city, already working in that city now (open jobs there), then rating. Phase 4 adds documents with expiry (insurance, licences), which block assignment when expired (spec §7).

### ServiceArea
A region the organization works in, made of cities (e.g. Gush Dan = Tel Aviv, Ramat Gan, Givatayim, …). Editing a region's cities changes the coverage of every professional who serves it.

| Field | Type | Notes |
|---|---|---|
| `name` | str | |
| `cities` | str[] | Becomes FK City once cities are a table (with the property's city) |

### History (derived, not stored)
The history on a property or customer card is a view over existing rows, newest first: ownership periods, leases (start–end, rent) and issues (with professional, resolution and actual cost). A property's history includes its parts. A customer's history covers their ownership periods (also past ones), the leases on those properties that overlap the ownership period, and issues whose `customer_id` snapshot is the customer. Summary: number of leases, tenants, issues, total repair cost, professionals used.

### ManagementAgreement
The contract between the company and an owner (spec §2). Created from the customer's details and exported as a document, or imported from an existing document.

| Field | Type | Notes |
|---|---|---|
| `number` | int | Human number per organization |
| `customer_id` | FK → Customer | |
| `property_ids` | FK[] → Property | Through a join table; a complex or building covers its parts |
| `start_date` / `end_date` | date / date? | No end date: until either side ends it |
| `fee_model` | enum `fixed` \| `percent_of_rent` \| `percent_with_minimum` | `percent_with_minimum`: the percentage or the monthly minimum, whichever is higher |
| `fee_minor` / `fee_percent` | int? / decimal? | The amount (fixed fee or monthly minimum) and the percentage the model uses; the other is empty |
| `plus_vat` | bool | The fee is before VAT |
| `billing_frequency` | enum `monthly` \| `quarterly` | When the fee is charged |
| `approval_threshold_minor` | int? | Owner consent above this cost (spec §7) |
| `language` | enum `he` \| `en` | |
| `source` | enum `generated` \| `imported` | |
| `file_id` | FK? → File | The imported or signed document, in private file storage (the sample keeps only `file_name`) |
| `signed_at` | date? | Empty = draft |

Status (derived): `draft` (not signed) → `upcoming` / `active` → `ended` (after `end_date`). Billing-plan versions (spec §4) come in Phase 2.

**Export:** a FormTemplate with context `agreement` renders the agreement (fields `agreement.*` and `customer.*`); dates are numeric (`31/12/2026`). It is printed, saved as PDF, or downloaded as a Word file built in the browser (`apps/admin/src/data/docx.ts`).

**Import** (`apps/admin/src/data/agreements.ts`, ported to `apps/api/core`): the document's text is read where it is opened (`.docx` or `.txt`; PDF later) — never by an outside service. Rules: a heading naming the owner ("## The owner", "הבעלים") marks the owner's section; labeled lines ("Name:", "ת.ז.:", "Phone:") give the values; the company's own name, phone and email are ignored; free text falls back to patterns ("between … and Moshe Levi, ID …") marked "please check". IDs are checked with the Israeli check digit. Property addresses are matched to existing properties. The user checks every value; an import into an existing customer only fills empty fields. The document's text is not stored. An agreement exported by the system always imports back exactly (tested with 150 random agreements per run).

Files are recognized by content, not name (`apps/admin/src/data/documents.ts`): `.docx`, and text in UTF-8, UTF-16 or Windows-1255; old `.doc` and password-protected files, PDFs, scans without text, damaged and oversized files each get a specific message. Parsing: Israeli and international phones; day-first dates, including Hebrew and English month names, only real calendar dates; names without titles or "(hereinafter …)"; co-owners, a fee "plus VAT" and reversed dates are flagged.

**Checks** (`apps/admin/src/data/checks.ts`, enforced by the data layer, shown before saving): errors block saving — name, phone, email, start and end dates, fee range, a duplicate agreement (same customer, start date and properties); warnings ask for a look — ID check digit or a passport, an unusual fee, a property already under another agreement for the same period, recorded as someone else's, or not found, a possible duplicate customer. **Export check:** every generated agreement document is read back with the import rules and compared with its record, field by field; a Word file is read back before it is saved. Agreement templates must use the fields in `AGREEMENT_REQUIRED`; the editor lists any that are missing.

Documents made from an agreement (FormTemplate context `agreement`; the main property's fields are available too): the **agreement** itself (`importable`: states every detail, checked against the record, imports back), a **power of attorney** (all current owners of the main property sign; appoints the company's representative; property with block and parcel), and a **price quote** (sent before signing, from a draft agreement). The import also reads the usual Israeli layout: parties as "בין … לבין" blocks (the designation "(להלן: …)" says which is the owner), the property in the recitals with its block and parcel, the term starting on signing, and fees such as "8.5% or ₪400, whichever is higher, plus VAT, at the start of each quarter".

### FormTemplate
A template for a printable document (handover protocol, work order…) or for a message (payment request, reminder).

| Field | Type | Notes |
|---|---|---|
| `name` | str | |
| `context` | enum `lease` \| `property` \| `customer` \| `tenant` \| `issue` \| `payment_request` \| `agreement` | The record a form is generated from; decides the available fields |
| `kind` | enum `document` \| `message` | |
| `body` | map language → text | Text with `{{field}}` placeholders; at least one language |
| `importable` | bool | Context `agreement` only: the template is the agreement itself (must use every field in `AGREEMENT_REQUIRED`) |

Template rules (`apps/admin/src/data/templates.ts`, ported to `apps/api/core`): placeholders per context are a fixed list; a known field without a value renders as "—" and is reported; an unknown field is left as written and reported. Line markers for documents: `#` title, `##` section, `###` subsection, `-` bullet, `[ ]` checkbox, `---` divider, underscores = blank to fill by hand. Generated documents are rendered in the template's language and direction, and printed, saved as PDF or downloaded as Word. Later: save the generated PDF to the record's documents.

### PaymentRequest, ReminderRule, OutgoingMessage (Phase 2, sample-only now)

**PaymentRequest**: `number`, `customer_id`, `property_id?`, `description`, `amount_minor`, `paid_minor`, `currency`, `issue_date`, `due_date`, `status` (`scheduled` → `sent` → `partially_paid` → `paid`; `paused` with `paused_reason`; `cancelled`). Overdue = past `due_date` with a balance (derived).

**ReminderRule** (per organization): `anchor` (`issue_date` \| `due_date`), `offset_days` (−3 = three days before), `channel` (`preferred` \| `whatsapp` \| `email`), `template_id`, `active`. `issue_date + 0` is the payment request itself. Defaults follow spec §5: the request, −3, 0, +7, +14.

**OutgoingMessage** (append-only): `payment_request_id`, `customer_id`, `rule_id?` (empty = sent by hand), `channel`, `to`, `body` (the text as sent), `status` (`ready` \| `queued` \| `sent` \| `delivered` \| `failed`), `at`.

**WhatsApp is not integrated.** A WhatsApp message is created as `ready`; the user opens a pre-filled chat (`https://wa.me/<number>?text=<message>`) and presses send, and the app records it as `sent`. Ready messages appear in "Needs attention". Email is sent by the system. Connecting the WhatsApp Business Platform later only changes how a `ready` message leaves.

Reminder job (daily worker task): for each request that is not paid, paused or cancelled, take the active rules not yet sent whose date has come; send only the latest of them (so a missed "3 days before" is never sent after the due date). Unique `(payment_request_id, rule_id)` makes the job idempotent. Email messages are sent; WhatsApp messages are prepared as `ready`. Channel: the rule's, or the customer's preferred (`phone` → WhatsApp); email without an address falls back to WhatsApp. Sending never changes the debt (spec §5).

### User
An employee using the admin app.

| Field | Type | Notes |
|---|---|---|
| `name` | str | |
| `email` | str | Login |
| `role` | enum `managing_director` \| `property_manager` \| `operations` \| `finance` \| `accountant` | Spec §8 |
| `active` | bool | |

## Coming in later phases

Agreement billing-plan versions (Phase 2), charges, payments and allocations (Phase 2), quotes, approvals and work orders (Phase 4), professional documents with expiry (Phase 4), building ledgers and HOA budgets (Buildings module), tasks and calendar items. Until then the dashboard figures for collections and debts use sample data.
