// The admin app reads data only through these functions. Today they compute results from the
// sample data; in Phase 0/1 the same signatures call the Python API, and screens do not change.
// Derived relationships (a customer's tenants, a property's current owner) are computed here the
// way the API will compute them — they are never stored twice (docs/DATA_MODEL.md).
import type { Customer, ID, Issue, IssueEvent, IssueStatus, Lease, Property, Tenant, Urgency, User } from "@/domain/types";
import { isOpen } from "@/domain/types";
import * as db from "./sample";

const today = () => new Date().toISOString().slice(0, 10);
const delay = <T,>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), 120)); // feels like a network call

const isCurrent = (r: { startDate: string; endDate?: string }, on = today()) =>
  r.startDate <= on && (!r.endDate || r.endDate >= on);

function find<T extends { id: ID }>(rows: T[], id: ID): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`Not found: ${id}`);
  return row;
}

// ---------- derived relationships ----------

function currentOwnerships(propertyId: ID) {
  return db.ownerships.filter((o) => o.propertyId === propertyId && isCurrent(o));
}

/** Managing customer = current owner with the largest share (until management agreements exist). */
function managingCustomer(propertyId: ID): Customer | undefined {
  const [top] = currentOwnerships(propertyId).sort((a, b) => b.sharePercent - a.sharePercent);
  return top && find(db.customers, top.customerId);
}

function activeLeases(propertyId: ID) {
  return db.leases.filter((l) => l.propertyId === propertyId && isCurrent(l));
}

function propertiesOfCustomer(customerId: ID) {
  const ids = new Set(db.ownerships.filter((o) => o.customerId === customerId && isCurrent(o)).map((o) => o.propertyId));
  return db.properties.filter((p) => ids.has(p.id));
}

export type ActorSummary = { type: "customer" | "tenant" | "user"; id: ID; name: string };

function actorName(ref: { type: "customer" | "tenant" | "user"; id: ID }): ActorSummary {
  const rows: { id: ID; name: string }[] = ref.type === "customer" ? db.customers : ref.type === "tenant" ? db.tenants : db.users;
  return { ...ref, name: rows.find((r) => r.id === ref.id)?.name ?? "—" };
}

// ---------- view models ----------

export type PropertyRow = Property & {
  owners: { customer: Customer; sharePercent: number }[];
  tenants: Tenant[];
  occupancy: "occupied" | "vacant";
  openIssues: number;
};

function toPropertyRow(p: Property): PropertyRow {
  const tenants = activeLeases(p.id).map((l) => find(db.tenants, l.tenantId));
  return {
    ...p,
    owners: currentOwnerships(p.id).map((o) => ({ customer: find(db.customers, o.customerId), sharePercent: o.sharePercent })),
    tenants,
    occupancy: tenants.length ? "occupied" : "vacant",
    openIssues: db.issues.filter((i) => i.propertyId === p.id && isOpen(i.status)).length,
  };
}

export type CustomerRow = Customer & { properties: number; tenants: number; openIssues: number; urgentIssues: number };

export type IssueRow = Issue & { property: Property; customer: Customer; reporter: ActorSummary; assignee?: User };

function toIssueRow(i: Issue): IssueRow {
  return {
    ...i,
    property: find(db.properties, i.propertyId),
    customer: find(db.customers, i.customerId),
    reporter: actorName(i.reporter),
    assignee: i.assigneeId ? find(db.users, i.assigneeId) : undefined,
  };
}

const URGENCY_RANK: Record<Urgency, number> = { emergency: 0, high: 1, normal: 2, low: 3 };
const byUrgencyThenAge = (a: Issue, b: Issue) =>
  URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.openedAt.localeCompare(b.openedAt);

export type LeaseRow = Lease & { property: Property; tenant: Tenant; customer?: Customer; daysLeft: number };

function toLeaseRow(l: Lease): LeaseRow {
  return {
    ...l,
    property: find(db.properties, l.propertyId),
    tenant: find(db.tenants, l.tenantId),
    customer: managingCustomer(l.propertyId),
    daysLeft: Math.round((Date.parse(l.endDate) - Date.parse(today())) / 86_400_000),
  };
}

// ---------- queries ----------

export function listCustomers(): Promise<CustomerRow[]> {
  return delay(
    db.customers.map((c) => {
      const props = propertiesOfCustomer(c.id);
      const tenantIds = new Set(props.flatMap((p) => activeLeases(p.id).map((l) => l.tenantId)));
      const open = db.issues.filter((i) => i.customerId === c.id && isOpen(i.status));
      return {
        ...c,
        properties: props.length,
        tenants: tenantIds.size,
        openIssues: open.length,
        urgentIssues: open.filter((i) => i.urgency === "emergency" || i.urgency === "high").length,
      };
    }),
  );
}

export type CustomerDetail = {
  customer: Customer;
  properties: PropertyRow[];
  tenants: { tenant: Tenant; lease: LeaseRow }[];
  issues: IssueRow[];
  pastProperties: { property: Property; endDate: string }[];
};

export function getCustomer(id: ID): Promise<CustomerDetail> {
  const customer = find(db.customers, id);
  const properties = propertiesOfCustomer(id).map(toPropertyRow);
  const tenants = properties.flatMap((p) =>
    activeLeases(p.id).map((l) => ({ tenant: find(db.tenants, l.tenantId), lease: toLeaseRow(l) })),
  );
  const pastProperties = db.ownerships
    .filter((o) => o.customerId === id && o.endDate && !isCurrent(o))
    .map((o) => ({ property: find(db.properties, o.propertyId), endDate: o.endDate! }));
  const issues = db.issues.filter((i) => i.customerId === id).map(toIssueRow).sort(byUrgencyThenAge);
  return delay({ customer, properties, tenants, issues, pastProperties });
}

export function listProperties(): Promise<PropertyRow[]> {
  return delay(db.properties.map(toPropertyRow));
}

export type PropertyDetail = {
  property: PropertyRow;
  leases: LeaseRow[]; // all leases, newest first
  issues: IssueRow[];
};

export function getProperty(id: ID): Promise<PropertyDetail> {
  const property = toPropertyRow(find(db.properties, id));
  const leases = db.leases.filter((l) => l.propertyId === id).map(toLeaseRow).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const issues = db.issues.filter((i) => i.propertyId === id).map(toIssueRow).sort(byUrgencyThenAge);
  return delay({ property, leases, issues });
}

export type TenantRow = Tenant & { leases: LeaseRow[]; openIssues: number };

export function listTenants(): Promise<TenantRow[]> {
  return delay(
    db.tenants.map((t) => ({
      ...t,
      leases: db.leases.filter((l) => l.tenantId === t.id && isCurrent(l)).map(toLeaseRow),
      openIssues: db.issues.filter((i) => i.reporter.type === "tenant" && i.reporter.id === t.id && isOpen(i.status)).length,
    })),
  );
}

export type TenantDetail = { tenant: Tenant; leases: LeaseRow[]; issues: IssueRow[] };

export function getTenant(id: ID): Promise<TenantDetail> {
  const tenant = find(db.tenants, id);
  const leases = db.leases.filter((l) => l.tenantId === id).map(toLeaseRow).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const issues = db.issues
    .filter((i) => i.reporter.type === "tenant" && i.reporter.id === id)
    .map(toIssueRow)
    .sort(byUrgencyThenAge);
  return delay({ tenant, leases, issues });
}

export type IssueFilter = { status?: "open" | "closed" | "all" | IssueStatus; urgency?: Urgency; customerId?: ID; propertyId?: ID; q?: string };

export function listIssues(filter: IssueFilter = {}): Promise<IssueRow[]> {
  const q = filter.q?.trim().toLowerCase();
  const rows = db.issues
    .filter((i) => {
      const f = filter.status;
      if (!f || f === "all") return true;
      if (f === "open") return isOpen(i.status);
      if (f === "closed") return !isOpen(i.status);
      return i.status === f;
    })
    .filter((i) => !filter.urgency || i.urgency === filter.urgency)
    .filter((i) => !filter.customerId || i.customerId === filter.customerId)
    .filter((i) => !filter.propertyId || i.propertyId === filter.propertyId)
    .map(toIssueRow)
    .filter((i) => !q || `${i.number} ${i.title} ${i.property.address} ${i.property.city} ${i.customer.name}`.toLowerCase().includes(q));
  return delay(rows.sort(byUrgencyThenAge));
}

export type IssueDetail = { issue: IssueRow; events: (IssueEvent & { actorName: string })[] };

export function getIssue(id: ID): Promise<IssueDetail> {
  const issue = toIssueRow(find(db.issues, id));
  const events = db.issueEvents
    .filter((e) => e.issueId === id)
    .map((e) => ({ ...e, actorName: actorName(e.actor).name }))
    .sort((a, b) => a.at.localeCompare(b.at));
  return delay({ issue, events });
}

// ---------- to-do and dashboard ----------

export type TodoItem =
  | { kind: "urgent_issue"; priority: number; issue: IssueRow }
  | { kind: "approval"; priority: number; issue: IssueRow; waitingDays: number }
  | { kind: "verify_payment"; priority: number; id: ID; customer: Customer; amountMinor: number; reportedAt: string }
  | { kind: "lease_ending"; priority: number; lease: LeaseRow };

/** Everything that needs a decision, most urgent first (spec §3 "Needs attention"). */
export function listTodo(): Promise<TodoItem[]> {
  const open = db.issues.filter((i) => isOpen(i.status));
  const items: TodoItem[] = [
    ...open
      .filter((i) => i.urgency === "emergency" || (i.urgency === "high" && (i.status === "new" || i.status === "under_review")))
      .map((i) => ({ kind: "urgent_issue" as const, priority: i.urgency === "emergency" ? 0 : 1, issue: toIssueRow(i) })),
    ...open
      .filter((i) => i.status === "awaiting_approval")
      .map((i) => ({
        kind: "approval" as const,
        priority: 2,
        issue: toIssueRow(i),
        waitingDays: Math.max(0, Math.round((Date.now() - Date.parse(i.openedAt)) / 86_400_000)),
      })),
    ...db.paymentsToVerify.map((p) => ({
      kind: "verify_payment" as const,
      priority: 3,
      id: p.id,
      customer: find(db.customers, p.customerId),
      amountMinor: p.amountMinor,
      reportedAt: p.reportedAt,
    })),
    ...db.leases
      .filter((l) => isCurrent(l))
      .map(toLeaseRow)
      .filter((l) => l.daysLeft <= 60)
      .map((l) => ({ kind: "lease_ending" as const, priority: 4, lease: l })),
  ];
  return delay(items.sort((a, b) => a.priority - b.priority));
}

export type Dashboard = {
  collections: typeof db.collections;
  debtAging: typeof db.debtAging;
  issues: { open: number; urgent: number; awaitingApproval: number; oldestApprovalDays: number; byStatus: { status: IssueStatus; count: number }[] };
  leasesEnding: LeaseRow[];
  occupancy: { occupied: number; vacant: number };
};

export function getDashboard(): Promise<Dashboard> {
  const open = db.issues.filter((i) => isOpen(i.status));
  const statuses = [...new Set(open.map((i) => i.status))];
  const props = db.properties.map(toPropertyRow);
  return delay({
    collections: db.collections,
    debtAging: db.debtAging,
    issues: {
      open: open.length,
      urgent: open.filter((i) => i.urgency === "emergency" || i.urgency === "high").length,
      awaitingApproval: open.filter((i) => i.status === "awaiting_approval").length,
      // Until approval events exist, waiting time is measured from when the issue was opened.
      oldestApprovalDays: Math.max(
        0,
        ...open.filter((i) => i.status === "awaiting_approval").map((i) => Math.floor((Date.now() - Date.parse(i.openedAt)) / 86_400_000)),
      ),
      byStatus: statuses.map((s) => ({ status: s, count: open.filter((i) => i.status === s).length })),
    },
    leasesEnding: db.leases.filter((l) => isCurrent(l)).map(toLeaseRow).filter((l) => l.daysLeft <= 90).sort((a, b) => a.daysLeft - b.daysLeft),
    occupancy: { occupied: props.filter((p) => p.occupancy === "occupied").length, vacant: props.filter((p) => p.occupancy === "vacant").length },
  });
}

export type SearchResult = { kind: "customer" | "property" | "tenant" | "issue"; id: ID; label: string; sub: string };

/** Global search by name, address, phone and issue number (spec §3). */
export function search(term: string): Promise<SearchResult[]> {
  const q = term.trim().toLowerCase();
  if (!q) return delay([]);
  const digits = q.replace(/\D/g, "");
  const phoneHit = (phone: string) => digits.length >= 3 && phone.replace(/\D/g, "").includes(digits.replace(/^0/, ""));
  const results: SearchResult[] = [
    ...db.customers
      .filter((c) => c.name.toLowerCase().includes(q) || phoneHit(c.phone))
      .map((c) => ({ kind: "customer" as const, id: c.id, label: c.name, sub: `#${c.number}` })),
    ...db.properties
      .filter((p) => `${p.address} ${p.city}`.toLowerCase().includes(q))
      .map((p) => ({ kind: "property" as const, id: p.id, label: `${p.address}${p.unit ? ` / ${p.unit}` : ""}`, sub: p.city })),
    ...db.tenants
      .filter((t) => t.name.toLowerCase().includes(q) || phoneHit(t.phone))
      .map((t) => ({ kind: "tenant" as const, id: t.id, label: t.name, sub: `#${t.number}` })),
    ...db.issues
      .filter((i) => String(i.number).includes(q.replace("#", "")) || i.title.toLowerCase().includes(q))
      .map((i) => ({ kind: "issue" as const, id: i.id, label: `#${i.number} ${i.title}`, sub: find(db.properties, i.propertyId).address })),
  ];
  return delay(results.slice(0, 12));
}
