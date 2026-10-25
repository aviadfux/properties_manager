# Management System Specification for a Property Management Company

**Property Management & Investments — General Edition**

Version 1.2 | October 21, 2026 | Specification and Phased Rollout

## 1. Purpose and Scope of the System

The system centralizes the management of clients, properties, buildings, management agreements, maintenance and collections. Its goal is to give the Managing Director a single business and operational view, let employees work according to their permissions, and serve tenants through a personal portal.

### Decisions Made

The system will serve apartments, commercial properties, offices, retail units and buildings with a homeowners' association (HOA / building committee). It will support a fixed fee, a percentage of rent, building pricing and custom pricing, including add-on services. A payment request is sent on the billing date; a financial document (invoice / receipt) is issued according to the payment event and the rules defined with the invoicing provider. Every expense requires approval by the Managing Director before a vendor is engaged, except a capped emergency path for safety incidents that is approved retroactively (Section 7).

The system is built as a generic product that supports several management companies, but is initially deployed for a single company. Every record belongs to an organization, data is isolated per organization on the server, and every company-specific setting — name, branding, language, currency, tax rates, invoicing-provider credentials and approval rules — is configuration, not code. Self-service sign-up and billing of management companies are out of scope until a second company is onboarded.

### Scope of the First Release

The target system includes a localized management interface (right-to-left and left-to-right) and a mobile-friendly tenant interface. At launch only the account of the Managing Director will be active, and the Buildings module will be developed as an extension before the first building is onboarded. Property owners will receive reports without a personal portal at this stage. Collecting rent and remitting it to owners, app-store apps and vendor log-in are out of scope.

### Document Structure

Section 2: data and clients. Section 3: screens and dashboard. Sections 4 to 6: pricing, collections and budgets. Section 7: maintenance and approvals. Section 8: portal and permissions. Section 9: infrastructure and integrations. Section 10: acceptance tests and execution plan. Section 11: launch version and payment methods.

Starting point: about 10 properties, no managed buildings, and a single internal user (the Managing Director). The intended document provider is a local invoicing service with an API (e.g., morning by Green Invoice). Payments are currently made by bank transfer; cheques, credit cards and standing orders will be needed later. The goal is to start using the system as soon as possible; no budget has been set. The target scope is described in Sections 2 to 10; the reduced launch version in Section 11 is a proposal for approval.

## 2. Data Model and Client Management

### Hierarchy and Relationships

A building contains units. A unit can be an apartment, retail unit, office or other commercial property, and can also exist without a managed building. One client may hold several units; a unit may have several owners. Relationships to owners and tenants are stored with start and end dates, so that a change of occupants does not alter history.

| Record | Key required fields |
|---|---|
| Client and contact | Name, client type, phone, email, business / tax ID where applicable, billing address, paying party, preferred language and channel, and messaging consent |
| Building | Address, HOA representatives, number of units, management period, collection target account, budget and allocation rules |
| Unit | Identifier, type, address, area, owners, occupants, occupancy status and building association |
| Management agreement | Client, properties, validity, price, calculation basis, billing dates, adjustment rules, owner-approval threshold and signed copy |
| Lease | Unit, parties, term, rent used for calculation, indexation, options and notice deadlines, guarantees, documents and reminders |
| Vendor | Trade, contact and payment details, documents, insurance and licenses with expiry, rating and active status |
| Organization | Name, branding, language, currency, tax settings, provider credentials and approval rules |
| Guarantee / deposit | Type (bank guarantee, promissory note, cash deposit), amount, provider, expiry, release conditions and linked lease |
| Insurance policy | Insured party, building or vendor, coverage, expiry and policy document |

### Sales and Service Process

Sales pipeline: new lead, contacted, needs discovery, property tour, price quote, negotiation, agreement signed, active client, or closed without a deal. Each lead has a source, an assigned user, the requested service, an estimated value and a next action. Closing without a deal requires a reason.

Converting a lead to a client carries over its contacts and documents and creates onboarding tasks: signing the agreement, setting up properties, importing balances, configuring charges and inviting tenants to the portal. The client card consolidates logged calls, tasks, charges, documents and service requests. Re-entering an existing record raises a possible-duplicate warning based on ID and contact details.

Leasing pipeline, separate from the sales pipeline, for finding tenants for vacant units: vacancy, listing, inquiry, viewing, application and screening, lease signing and move-in. Each vacancy shows its days vacant and asking rent; each applicant has a source, status and next action.

Ending a management agreement starts an offboarding flow: final statement and open balances, handover of documents and keys, revocation of portal access, and retention of records according to the retention policy.

### Lease Lifecycle

Move-in and move-out are recorded with photos, condition notes, meter readings and key handover. A tenant change creates a checklist for transferring electricity, water, gas and municipal-tax accounts, with confirmation documents. Guarantees and deposits are tracked until release, which requires a final balance check. Renewal options create reminders before the notice deadline.

### Glossary

| Term | Definition |
|---|---|
| Organization | A management company using the system; every record belongs to exactly one organization |
| Client | The party that signs a management agreement with the company |
| Owner | The registered owner of a unit; may or may not be the client |
| Tenant / occupant | The person or business occupying a unit under a lease |
| Payer | The party actually billed for a specific charge; may differ from the liable party |
| Managing Director | The organization's principal administrator and expense approver |

## 3. Screens and Management Dashboard

Main menu: Overview, Clients & Leads, Leasing, Properties & Buildings, Agreements, Collections, Budgets & Expenses, Service Requests, Vendors, Tasks, Calendar, Reports and Settings. Global search by client, address, phone and request number. Every list supports filtering, sorting and export according to permissions.

### Managing Director Dashboard

| Metric | Meaning and click-through action |
|---|---|
| Collections this month | Amount paid versus charges due this month; shows the collection rate and the list of open balances |
| Overdue debts | Balances unpaid after the due date, aged up to 30, 31–60, 61–90 and over 90 days |
| Company revenue | Management-fee and service receipts, separate from funds collected on behalf of buildings or clients |
| Pending approvals | Number of requests, total amount, waiting time and a link to the quotes awaiting approval |
| Maintenance | Open, urgent, awaiting-vendor and SLA-breaching requests |
| Building status | Budget vs. actual, approved commitments and projected balance; drill-down into each building |
| Clients and agreements | Leads without follow-up, management agreements and leases nearing expiry |
| Expiring items | Guarantees, insurance policies, vendor documents and renewal-option deadlines due in the next 60 days |

### Display Rules

The top of the screen shows period, assigned user, property type and building filters. Every amount shows its calculation basis and last-update time. A payment request is never shown as a receipt. Building funds are never counted as the management company's revenue. Provisional data and unverified payments are flagged and not counted as completed collections.

### Property Card and Building Card

Property card: details, owners and occupants over time, agreements, charges, issues and documents. Building card: units, HOA representatives, collections, budget, regular vendors and preventive maintenance. Employees see their own tasks and assigned requests, without financial information not required for their role.

### Unified Calendar

One calendar for lease expiries, renewal-option deadlines, inspections and maintenance, cheque deposit dates, guarantee expiries and document renewals, with reminders to the responsible user. Every calendar item links to its source record.

## 4. Pricing Engine and Recurring Billing

Each agreement contains a dated billing plan. A price change creates a new version effective from a set date and never rewrites past charges. Each charge is linked to the paying client, the property or building, the service period, the service type and the party on whose behalf the money is collected.

| Model | Calculation rule |
|---|---|
| Fixed amount | Agreed amount per unit or per agreement, at the defined frequency and date |
| Percentage of rent | Percentage of contractual rent or of rent actually received, as explicitly defined in the agreement |
| Building management | Price per building or amount per unit; company fees are kept separate from HOA dues |
| Custom pricing | A combination of a fixed component, a proportional component, a minimum or a cap — only if defined in the agreement |
| Add-on service | One-off charge line based on an approved price and service documentation |

### Per-Agreement Settings

Start and end date; billing day and due date; frequency; handling of partial months and vacant units; price excluding or including tax, as configured; indexation rules if required; discount and its validity; paying party and delivery address. Indexation or interest is never applied without an approved setting.

The percentage model requires choosing a basis. If the basis is actual collection, a verified receipt figure must be entered or imported, even when rent is paid directly to the owner. If the figure is missing, the charge is routed for handling and is never calculated on a guess.

### Monthly Controls

A preview shows expected charges, changes and missing data. Once automation is enabled, each agreement and service period produces exactly one charge. Re-running never duplicates charges. An expired agreement stops future charges and preserves past balances.

Illustrative calculation only: a contractual rent of 6,000 and a 5% management rate produce a billing basis of 300, before the configured tax adjustments. The example is not a recommended price list.

### Indexation, Late Fees and Payment Plans

Indexation of rent or fees (e.g., to the consumer price index) creates a new price version from its effective date, using the index source, base month and floor rules defined in the agreement; past charges are never recalculated. Late fees are charged only where the contract allows them and the policy is approved, and appear as a separate charge line. A payment plan for an existing debt splits repayment into installments while the original charges remain intact and traceable.

## 5. Payment Requests and Document Issuance

### Standard Flow

1. The billing engine creates a payment request with period, breakdown, due date, paying party and destination details.
2. The request is sent through the configured channel and logged.
3. A notification arrives from a payment provider, or an employee records a transfer with proof attached.
4. A manual payment waits for verification by an authorized user.
5. After verification, the receipt is allocated to charges and issuance of the appropriate document is triggered.
6. The document is sent and linked to the client card.

### Accounting Integration

Documents are issued through the invoicing provider (e.g., morning by Green Invoice). The document type, issuing event, issuing entity and handling of credit notes will be defined with the accountant. Before development, the subscription plan, API permissions and supported operations will be verified in the sandbox. HOA collections and company documents will get separate rules before the Buildings module is enabled.

The provider is the source of truth for document numbers and issuance status; the system manages charges and payment allocations. An issued document is never deleted or edited locally. Corrections go through the provider's supported operation, logged and linked to the original document.

### Mandatory Exception Handling

A partial payment leaves an open balance; one payment can cover several charges; a credit balance is kept and allocated only according to an approved policy. A screenshot of a transfer is not, on its own, confirmation that money was received. Cancellations, refunds and failed payments are recorded as correcting entries with the appropriate document handling.

A duplicate event never creates an additional receipt or document. On a timeout without a response, the system checks whether the document was created before retrying. Failures appear in an exceptions queue. For cheques, receipt, deposit and clearance are tracked separately; document issuance follows the event defined with the accountant and does not necessarily wait for clearance. A security cheque is flagged separately from a payment cheque.

### Collections and Reminders

Suggested reminders: three days before the due date, on the due date, and after 7 and 14 days overdue. Timing and wording are configurable. Full payment stops reminders; a dispute allows a pause with a reason and a review date. Sending a reminder does not change the debt.

### Bank Statement Import and Accountant Export

Bank statements (CSV / Excel) can be imported; the system suggests matches between incoming transfers and open charges, and an authorized user confirms each match before it counts as verification. This is an intermediate step before automatic bank reconciliation. A periodic export of charges, receipts, documents and expenses is produced in a format agreed with the accountant, who may also get a read-only role.

## 6. Building Finances and Expenses

### Separation of Financial Ledgers

Each building, and each client whose funds are managed, has a separate sub-ledger with an opening balance, receipts, expenses, commitments and a target account. The system never assumes bank-level separation exists merely because data is filtered by building. Bank accounts and entities will be configured during financial planning.

Management fees can be an expense of the building and revenue of the company; the two records are linked and never double-counted in a consolidated report. A transfer between accounts is marked as a transfer, not as new revenue.

### HOA Budget and Unit Charges

Annual and monthly budget by category: cleaning, elevators, common-area electricity, insurance, gardening, repairs and management fees. Allocation rules are defined per building: fixed amount, by area, proportional share or an approved special charge. No uniform allocation rule is assumed across buildings.

Each charge defines who is liable and who actually pays. A tenant change keeps debts according to the original periods and assignments and never transfers them automatically to the new tenant. A budget change keeps a version and an approval, and never replaces past charges.

### Expense and Vendor Payment Cycle

Request and quote; approval by the Managing Director; owner consent when the amount exceeds the agreement's threshold; budget commitment; work order; completion sign-off; vendor invoice intake; payment preparation; approval and execution through an external channel; reconciliation and recording of proof. Approving the work is not confirmation that the work was done or that payment was sent.

In the first release, vendor payments and payment lists are managed; bank transfers are not automated. Proof is required before a payment is marked as paid. Alerts for duplicate vendor invoices, amounts exceeding the approval and missing building allocation appear before completion.

### Reports

Balances and debts per unit; budget vs. actual and commitments; cash flow based on actual transactions; owner statement with services, expenses and balances for the period. Management profitability includes company fees less the costs attributable to the company; labor time is included only if time tracking is enabled.

## 7. Maintenance and Approval of Every Expense

### Service Request Lifecycle

A tenant or employee opens a request with property, location, category, description, photos and reported urgency. The employee verifies the urgency, records the risk and assigns a responsible person. Quotes can be requested without ordering work. Engaging a vendor or committing to a payment is blocked until the Managing Director approves.

Statuses: new, under review, awaiting quote, awaiting approval, approved, scheduled, in progress, awaiting completion sign-off, closed or cancelled. A rejection returns the request for revision. Closing requires a resolution description, completion date and actual cost, or an explicit statement that there was no cost.

### Managing Director Approval Card

A single screen shows the issue, property, vendor, quote, total amount, cost-bearing party, budget status and the employee's recommendation. The approver can approve, reject or request more information. The approval is stored with identity, timestamp, amount, scope of work and quote version.

The approval is limited to the vendor, amount and scope presented. Any material change requires re-approval before further commitment. An urgent request triggers an immediate alert; the emergency path is described below. Time waiting for approval is shown separately so that delays are not hidden.

### Emergency Path and Backup Approver

For safety incidents in defined categories (e.g., flooding, gas leak, electrical hazard, lock-out, elevator entrapment), an authorized employee may engage a vendor up to an emergency cap set per organization, without prior approval. The action triggers an immediate alert, is flagged for retroactive approval by the Managing Director within 24 hours and stays on the dashboard until approved. Above the cap, prior approval is always required. The Managing Director can appoint a backup approver, with a validity period and an amount limit, for times they are unavailable; every approval records who approved and under which authority.

### Owner Consent

When the management agreement sets an owner-approval threshold and the cost borne by the owner exceeds it, the work order stays blocked until the owner's consent is recorded (method, date, amount and scope). Consent is requested through a logged message and stored with the expense.

### Recurring Services and Preventive Maintenance

For recurring work, a periodic spending framework may be proposed for approval by the Managing Director, with vendor, amount, number of visits and validity. Using such a framework requires their explicit choice; the default is individual approval for every order. Recurring maintenance only creates a task and never orders work on its own.

The maintenance schedule includes inspections, audits and document renewals as configured. Proposed service targets, to be refined: an urgent request alerts immediately; other requests get response and resolution targets by category and business hours. The targets are not commitments to clients until approved.

Vendor insurance policies, licenses and certificates are tracked with expiry dates; a vendor whose mandatory documents have expired cannot be assigned. Statutory building inspections (elevators, fire safety, gas systems) and building insurance renewals feed the maintenance schedule and the calendar.

### Notifications and Records

The tenant receives updates on intake, requests for details, scheduling and completion. Internal notes and commercial quotes are never exposed in the portal. Duplicate requests for the same incident can be merged while preserving the requesters and the history.

Field staff work in a mobile view of their assigned requests, with before / after photos, vendor arrival and completion confirmation.

## 8. Personal Portal and User Permissions

### Tenant Portal

Access is by invitation and verification. The home page shows the units the user is authorized for, relevant charges, issue status and documents explicitly shared with them. The tenant can open a request, attach files, answer an information request, view a payment request and submit proof of payment. A payment link is shown if a suitable payment provider is chosen.

A tenant never sees the management agreement, company profits, owner documents, other tenants' details or the full building budget. When a lease ends, access to new information about the property is revoked; access to historical personal documents is governed by a separate policy. A tenant with several units can switch between them without data mixing.

| Role | Proposed permissions |
|---|---|
| Managing Director (super admin) | All data, users, pricing, expense approval, reports and approval of exceptional financial actions |
| Property manager | Assigned clients and properties, agreements (view only), service requests, expense requests and tasks; no expense approval |
| Operations staff | Assigned requests and tasks, scheduling and progress updates; no profitability reports or price changes |
| Finance (if defined) | Charges, receipt verification, documents, reconciliations and payment preparation; no expense approval in place of the Managing Director |
| Tenant | Only their own personal information and assigned charges; opening requests and access to shared documents |
| Accountant (optional) | Read-only access to charges, receipts, documents, expenses and exports |

### Enforcement and Audit

Permissions are enforced on the server, including in exports, files and direct links. Hiding a button in the UI is not enough. Every financial change, permission change, approval, cancellation and sensitive export is recorded in an audit log. Assigning a role never grants an employee the expense-approval authority of the Managing Director.

Identity documents and payment details not required by the process must not be uploaded. Sharing a document with a tenant is an explicit, logged action — never an automatic result of attaching it to the property file.

### Communication

Messages are sent from templates per channel and language. Each contact has a preferred language and channel and a recorded consent for non-essential messages; opt-outs are honored. All outgoing and incoming messages are kept in the communication history on the client and tenant cards.

### Privacy and Data Protection

The system complies with the applicable privacy law (e.g., Israel's Privacy Protection Law and its Data Security Regulations, or GDPR where relevant): a database definition document, retention periods per data type, handling of access, correction and deletion requests, data-processing agreements with vendors and a breach-notification procedure.

## 9. Infrastructure, Integrations and Quality Requirements

### Recommended Technical Architecture

A mobile-responsive web application with a localized UI supporting right-to-left and left-to-right languages, a backend service, a relational database, private file storage and a job queue for monthly runs and message delivery. Billing and approval logic is enforced server-side. The development stack will be chosen based on the maintenance team and the budget.

Every record belongs to an organization and is isolated per organization on the server. All UI strings are kept in translation files from day one; language, currency, tax rates with effective dates and date formats are set per organization.

### Integrations in the First Release

Integration with the invoicing provider for client matching, document issuance, status lookup and supported corrections — first in a sandbox. The provider's official developer documentation (e.g., morning) exposes APIs for documents, clients, payments and incoming webhooks. Exact capabilities will be verified in the business account. Email is used to send payment requests; the opening-data import runs after a dry run and approval.

Card processing, WhatsApp or SMS messaging, automatic bank reconciliation and e-signature are separate integrations to be priced and decided. They must not be assumed to be included in the invoicing system's price. Before choosing a vendor, its actual capabilities, costs and support for the required issuer identity will be checked.

### AI Assistance

Optional AI features: classifying and prioritizing service requests from free text and photos; extracting data from vendor invoices and payment proofs for human confirmation; drafting replies and reminders. AI output is always a suggestion: it never approves an expense, verifies a payment or issues a document.

### Reliability and Security

Strong authentication (MFA) for internal users, immediate lock-out of removed users, encryption in transit and at rest, secrets managed outside the code, time-limited file links, file scanning and login rate-limiting. Full credit-card details are never stored in the system; payment is handled by a dedicated provider if one is chosen.

Re-runs and duplicate messages never duplicate charges or documents. Cross-system operations get a stable idempotency key, a retry queue and an exceptions queue. A daily reconciliation process matches receipts with documents and charges. A failure in an external service is never recorded as a success.

### Proposed Targets for Approval

A test environment separate from production, error monitoring and daily backups. Initial target: maximum data loss of 24 hours (RPO) and recovery within one business day (RTO), subject to the chosen infrastructure and a restore test. Proposed load times: up to 3 seconds for common lists under the agreed load. The number of properties, users and files must be set before performance testing.

Dates in the business's local time zone, money stored in minor units (e.g., cents / agorot) without cumulative rounding, consistent locale formatting, and proper operation on mobile and by keyboard. The developer contract will define ownership of code and data, infrastructure access, full export, maintenance, support and vendor costs.

A full export of all data and files in open formats is available to the organization at any time. Business monitoring raises alerts when a billing run fails, the exceptions queue grows or sync with the invoicing provider falls behind — in addition to technical error monitoring.

## 10. Acceptance Tests and Execution Plan

### Scenarios That Must Pass Before Go-Live

1. Fixed and percentage charges are generated per agreement, including a partial month; a second run does not duplicate a charge.
2. A partial payment leaves the correct balance, and full payment stops reminders.
3. A duplicate payment notification or a missing response from a provider does not create a duplicate document.
4. An issuance failure enters the exceptions queue and is resolved without recording an additional payment.
5. An employee cannot engage a vendor before approval by the Managing Director, even via a direct server call; changing a quote invalidates the previous approval.
6. A tenant cannot view another unit's data by changing a URL or link.
7. Replacing a tenant preserves past debts.
8. The company report does not count HOA receipts as company revenue.
9. A duplicate import is detected and opening balances match the source.
10. Restoring from backup returns the data and files selected for the test.
11. An emergency expense within the cap is executed and flagged for retroactive approval; above the cap it is blocked.
12. A vendor with an expired insurance certificate cannot be assigned.
13. An indexation update creates a new price version without changing past charges.
14. An owner-approval threshold blocks the work order until the owner's consent is recorded.
15. A user of one organization cannot access another organization's data, even via a direct server call.
16. A tenant's access request can be fulfilled with a complete export of their personal data.

### Recommended Development Order

| Phase | Deliverable and exit criteria |
|---|---|
| Detailed design | Close open decisions, select vendors and prototype the screens; approve the three core workflows |
| Operational core | Clients, properties, buildings, leases, permissions, service requests and approvals; demo with test data |
| Financial core | Pricing engine, payment requests, receipts, documents, budget and reports; validated against the finance scenarios |
| Portal and pilot | Tenant portal, notifications, import, permission and restore tests; a limited pilot before expansion |

### Decisions Still Required

Open decisions: identity of the issuing business and the target account; invoicing-provider plan and API permissions; basis for percentage-based management fees; partial-month and vacant-unit policy; source of opening data; expected number of tenant users; development and maintenance budget. The standing-order type will be decided separately: customer-initiated recurring transfer, authorized bank direct debit, or recurring card charge. The Managing Director will verify receipts at launch.

Also to decide: emergency cap amount and categories; the backup approver; default owner-approval thresholds; whether leasing is offered at launch; languages at launch; retention periods; the phase for AI features.

A quote will be requested separately for the launch version and for each extension, including running costs, integrations, warranty and handover of code and data. Target extensions include buildings, employees, a full tenant portal, credit cards and standing orders. An owner portal, vendor log-in, rent collection and app-store apps remain future options.

## 11. Launch Version and Payment Method Support

### Launch Recommendation

Start with a management core for about 10 properties and a single internal user. The launch includes clients and leads, properties, agreements, documents, tasks and issues, fixed and percentage management fees, payment requests, reminders and the invoicing-provider integration. The Managing Director approves expenses and verifies transfers; fields are designed so that employees and buildings can be added without rewriting history.

At launch the same person approves expenses, verifies receipts and issues documents. This is an accepted, documented control gap for the pilot; once a finance role exists, receipt verification moves to a second user.

At launch the dashboard shows this month's charges, verified receipts, debts, issues, tasks and leases nearing expiry. Building budget data is hidden until the module is enabled. Prices are stored per agreement, and the method for calculating percentage fees will be decided before clients are onboarded.

### Bank Transfers and Document Issuance

For a regular transfer: an automatic payment request, identification and verification of the payment by the Managing Director, then issuance and delivery of the document through the invoicing provider. The button will read “Verify receipt and issue document”. A screenshot of proof never confirms money automatically. If a document was already issued directly in the provider, it is linked to the payment without issuing another one.

Some invoicing providers (e.g., morning) also offer a pay-by-bank service via a link, with automatic document issuance. This is a dedicated payment channel, not guaranteed identification of every regular transfer. Adding it depends on verifying the account, bank coverage and the ability to sync with the system.

### Cheques, Credit Cards and Standing Orders

Cheques: cheque number, bank, branch, account, drawer, amount, receipt and due dates, cheque type and status. Deposit reminder and recording of a bounce or replacement. The balance of uncleared cheques is shown separately from the cash balance in the bank. Receiving a cheque is never shown as a bank deposit.

Credit cards: a payment link through an agreed provider, verification of the success notification, handling of failure or refund, and linking to the document. Standing order: defined according to the chosen type, with authorization, billing cycle, failure and cancellation. It must not be assumed that the invoicing integration enables bank direct debit or recurring card charges.

### Extension Order and Delivery Terms

First extension: a reduced tenant portal with service requests and documents; it remains in the target requirements but is proposed after the internal pilot. Next, additional payment methods as needed. The Buildings module and HOA collections are enabled before the first building is onboarded. Each extension is priced and tested separately; this document does not commit to a development vendor's timeline.

Pilot criteria: onboarding 10 real properties, one billing cycle, one verified transfer, one synced document, a duplicate test, opening an issue and a backup restore. The integration is tested first with test data; real documents are issued only after the business is configured and the issuance rules are approved.

### Official Sources for Integration Verification

- Invoicing provider documentation (example): https://developers.morning.co/
- Pay-by-bank service: greeninvoice.co.il, article on payment initiation and direct transfer. Checked on October 21, 2026. Plan terms and capabilities must be verified before purchase and development.
