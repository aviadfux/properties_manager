// The admin app reads data only through these functions. Today they compute results from the
// sample data; in Phase 0/1 the same signatures call the Python API, and screens do not change.
// Derived relationships (a customer's tenants, a property's current owner) are computed here the
// way the API will compute them — they are never stored twice (docs/DATA_MODEL.md).
import type {
  Channel,
  Customer,
  FormContext,
  FormTemplate,
  ID,
  Issue,
  IssueCategory,
  IssueEvent,
  IssueStatus,
  Lease,
  OutgoingMessage,
  Ownership,
  PaymentRequest,
  Professional,
  Property,
  ReminderRule,
  ServiceArea,
  Tenant,
  Urgency,
  User,
} from "@/domain/types";
import { isOpen } from "@/domain/types";
import { dictionaries, formatters, type Locale } from "@/i18n";
import * as db from "./sample";
import { render } from "./templates";

const today = () => new Date().toISOString().slice(0, 10);
// Feels like a network call in the browser; immediate in tests.
const delay = <T,>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), import.meta.env.MODE === "test" ? 0 : 120));
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

const isCurrent = (r: { startDate: string; endDate?: string }, on = today()) =>
  r.startDate <= on && (!r.endDate || r.endDate >= on);

function find<T extends { id: ID }>(rows: T[], id: ID): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`Not found: ${id}`);
  return row;
}

export const propertyLabel = (p: Property) => `${p.address}${p.unit ? ` / ${p.unit}` : ""}`;

// ---------- property hierarchy ----------
// A property may be part of another (unit → building → complex). Only `parentId` is stored;
// everything else here is derived from it.

const childrenOf = (id: ID) => db.properties.filter((p) => p.parentId === id).sort((a, b) => a.number - b.number);
const descendants = (id: ID): Property[] => childrenOf(id).flatMap((c) => [c, ...descendants(c.id)]);
const leavesOf = (id: ID) => descendants(id).filter((p) => !childrenOf(p.id).length);

function ancestors(p: Property): Property[] {
  const chain: Property[] = [];
  for (let cur = p; cur.parentId; ) {
    cur = find(db.properties, cur.parentId);
    chain.unshift(cur);
  }
  return chain;
}

/** Orders properties as a tree (parents before their parts) and records each row's depth within the set. */
function treeOrder(rows: Property[]): { property: Property; depth: number }[] {
  const ids = new Set(rows.map((p) => p.id));
  const out: { property: Property; depth: number }[] = [];
  const walk = (p: Property, depth: number) => {
    out.push({ property: p, depth });
    rows.filter((c) => c.parentId === p.id).sort((a, b) => a.number - b.number).forEach((c) => walk(c, depth + 1));
  };
  rows.filter((p) => !p.parentId || !ids.has(p.parentId)).sort((a, b) => a.number - b.number).forEach((p) => walk(p, 0));
  return out;
}

// ---------- derived relationships ----------

/**
 * Current ownerships of a property. A property without ownership rows of its own inherits them from
 * the nearest ancestor that has them (a unit in a building owned as a whole); `from` says which one.
 */
function effectiveOwnerships(propertyId: ID): { rows: Ownership[]; from?: Property } {
  const own = db.ownerships.filter((o) => o.propertyId === propertyId && isCurrent(o));
  if (own.length) return { rows: own };
  const p = find(db.properties, propertyId);
  if (!p.parentId) return { rows: [] };
  const inherited = effectiveOwnerships(p.parentId);
  return { rows: inherited.rows, from: inherited.from ?? find(db.properties, p.parentId) };
}

/** Managing customer = current owner with the largest share (until management agreements exist). */
function managingCustomer(propertyId: ID): Customer | undefined {
  const [top] = [...effectiveOwnerships(propertyId).rows].sort((a, b) => b.sharePercent - a.sharePercent);
  return top && find(db.customers, top.customerId);
}

function activeLeases(propertyId: ID) {
  return db.leases.filter((l) => l.propertyId === propertyId && isCurrent(l));
}

/** Everything the customer currently owns, directly or as part of a larger property they own. */
function propertiesOfCustomer(customerId: ID) {
  return db.properties.filter((p) => effectiveOwnerships(p.id).rows.some((o) => o.customerId === customerId));
}

export type ActorSummary = { type: "customer" | "tenant" | "user"; id: ID; name: string };

function actorName(ref: { type: "customer" | "tenant" | "user"; id: ID }): ActorSummary {
  const rows: { id: ID; name: string }[] = ref.type === "customer" ? db.customers : ref.type === "tenant" ? db.tenants : db.users;
  return { ...ref, name: rows.find((r) => r.id === ref.id)?.name ?? "—" };
}

// ---------- view models ----------

export type Occupancy = "occupied" | "vacant" | "partial";

export type PropertyRow = Property & {
  owners: { customer: Customer; sharePercent: number }[];
  ownersFrom?: Property; // set when the owners are inherited from a larger property
  tenants: Tenant[];
  occupancy: Occupancy;
  units?: { occupied: number; total: number }; // for properties that contain others
  parts: number; // direct parts (units in a building, buildings in a complex)
  openIssues: number; // including issues in its parts
  depth: number; // nesting level within the list it appears in
};

function toPropertyRow(p: Property, depth = 0): PropertyRow {
  const tenants = activeLeases(p.id).map((l) => find(db.tenants, l.tenantId));
  const owners = effectiveOwnerships(p.id);
  const leaves = leavesOf(p.id);
  const occupiedLeaves = leaves.filter((u) => activeLeases(u.id).length).length;
  const scope = new Set([p.id, ...descendants(p.id).map((d) => d.id)]);
  return {
    ...p,
    owners: owners.rows.map((o) => ({ customer: find(db.customers, o.customerId), sharePercent: o.sharePercent })),
    ownersFrom: owners.from,
    tenants,
    occupancy: leaves.length
      ? occupiedLeaves === leaves.length
        ? "occupied"
        : occupiedLeaves
          ? "partial"
          : "vacant"
      : tenants.length
        ? "occupied"
        : "vacant",
    units: leaves.length ? { occupied: occupiedLeaves, total: leaves.length } : undefined,
    parts: childrenOf(p.id).length,
    openIssues: db.issues.filter((i) => scope.has(i.propertyId) && isOpen(i.status)).length,
    depth,
  };
}

const toPropertyTree = (rows: Property[]) => treeOrder(rows).map(({ property, depth }) => toPropertyRow(property, depth));

export type CustomerRow = Customer & { properties: number; tenants: number; openIssues: number; urgentIssues: number };

export type IssueRow = Issue & { property: Property; customer: Customer; reporter: ActorSummary; assignee?: User; professional?: Professional };

function toIssueRow(i: Issue): IssueRow {
  return {
    ...i,
    property: find(db.properties, i.propertyId),
    customer: find(db.customers, i.customerId),
    reporter: actorName(i.reporter),
    assignee: i.assigneeId ? find(db.users, i.assigneeId) : undefined,
    professional: i.professionalId ? find(db.professionals, i.professionalId) : undefined,
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
    daysLeft: daysBetween(today(), l.endDate),
  };
}

// ---------- history ----------
// One timeline per property or customer: ownership periods, leases and issues with their cost.

export type HistoryEvent =
  | { kind: "ownership"; date: string; endDate?: string; property: Property; customer: Customer; sharePercent: number }
  | { kind: "lease"; date: string; endDate: string; lease: LeaseRow }
  | { kind: "issue"; date: string; issue: IssueRow };

export type History = {
  events: HistoryEvent[]; // newest first
  summary: { leases: number; tenants: number; issues: number; repairCostMinor: number; professionals: number };
};

function buildHistory(ownerships: Ownership[], leases: Lease[], issues: Issue[]): History {
  const leaseRows = leases.map(toLeaseRow);
  const issueRows = issues.map(toIssueRow);
  const events: HistoryEvent[] = [
    ...ownerships.map((o) => ({
      kind: "ownership" as const,
      date: o.startDate,
      endDate: o.endDate,
      property: find(db.properties, o.propertyId),
      customer: find(db.customers, o.customerId),
      sharePercent: o.sharePercent,
    })),
    ...leaseRows.map((l) => ({ kind: "lease" as const, date: l.startDate, endDate: l.endDate, lease: l })),
    ...issueRows.map((i) => ({ kind: "issue" as const, date: i.openedAt.slice(0, 10), issue: i })),
  ];
  return {
    events: events.sort((a, b) => b.date.localeCompare(a.date)),
    summary: {
      leases: leases.length,
      tenants: new Set(leases.map((l) => l.tenantId)).size,
      issues: issues.length,
      repairCostMinor: issues.reduce((sum, i) => sum + (i.actualCostMinor ?? 0), 0),
      professionals: new Set(issues.flatMap((i) => (i.professionalId ? [i.professionalId] : []))).size,
    },
  };
}

/** A property's history, including its parts (a building's history includes its units). */
function propertyHistory(id: ID): History {
  const scope = new Set([id, ...descendants(id).map((d) => d.id)]);
  return buildHistory(
    db.ownerships.filter((o) => o.propertyId === id),
    db.leases.filter((l) => scope.has(l.propertyId)),
    db.issues.filter((i) => scope.has(i.propertyId)),
  );
}

/** A customer's history: their ownership periods, and the leases and issues during them. */
function customerHistory(customerId: ID): History {
  const owned = db.ownerships.filter((o) => o.customerId === customerId);
  const leases = owned.flatMap((o) => {
    // Parts without ownership rows of their own belong to the owner of the whole.
    const parts = descendants(o.propertyId).filter((d) => !db.ownerships.some((x) => x.propertyId === d.id));
    const scope = new Set([o.propertyId, ...parts.map((d) => d.id)]);
    return db.leases.filter((l) => scope.has(l.propertyId) && l.startDate <= (o.endDate ?? "9999") && l.endDate >= o.startDate);
  });
  return buildHistory(owned, [...new Set(leases)], db.issues.filter((i) => i.customerId === customerId));
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
  history: History;
};

export function getCustomer(id: ID): Promise<CustomerDetail> {
  const customer = find(db.customers, id);
  const properties = toPropertyTree(propertiesOfCustomer(id));
  const tenants = properties.flatMap((p) =>
    activeLeases(p.id).map((l) => ({ tenant: find(db.tenants, l.tenantId), lease: toLeaseRow(l) })),
  );
  const pastProperties = db.ownerships
    .filter((o) => o.customerId === id && o.endDate && !isCurrent(o))
    .map((o) => ({ property: find(db.properties, o.propertyId), endDate: o.endDate! }));
  const issues = db.issues.filter((i) => i.customerId === id).map(toIssueRow).sort(byUrgencyThenAge);
  return delay({ customer, properties, tenants, issues, pastProperties, history: customerHistory(id) });
}

export function listProperties(): Promise<PropertyRow[]> {
  return delay(toPropertyTree(db.properties));
}

export type PropertyDetail = {
  property: PropertyRow;
  partOf: Property[]; // outermost first
  parts: PropertyRow[]; // everything inside it, as a tree
  leases: LeaseRow[]; // all leases of this property, newest first
  issues: IssueRow[]; // including issues in its parts
  history: History;
};

export function getProperty(id: ID): Promise<PropertyDetail> {
  const p = find(db.properties, id);
  const scope = new Set([id, ...descendants(id).map((d) => d.id)]);
  const leases = db.leases.filter((l) => l.propertyId === id).map(toLeaseRow).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const issues = db.issues.filter((i) => scope.has(i.propertyId)).map(toIssueRow).sort(byUrgencyThenAge);
  return delay({
    property: toPropertyRow(p),
    partOf: ancestors(p),
    parts: toPropertyTree(descendants(id)),
    leases,
    issues,
    history: propertyHistory(id),
  });
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

export type IssueDetail = {
  issue: IssueRow;
  partOf: Property[];
  events: (IssueEvent & { actorName: string; professionalName?: string })[];
};

export function getIssue(id: ID): Promise<IssueDetail> {
  const issue = toIssueRow(find(db.issues, id));
  const events = db.issueEvents
    .filter((e) => e.issueId === id)
    .map((e) => ({
      ...e,
      actorName: actorName(e.actor).name,
      professionalName: e.professionalId ? find(db.professionals, e.professionalId).name : undefined,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
  return delay({ issue, partOf: ancestors(issue.property), events });
}

// ---------- professionals ----------

export type ProfessionalRow = Professional & {
  areas: ServiceArea[];
  coverage: string[]; // every city served: the regions' cities plus extra cities
  workingNow: { city: string; jobs: number }[]; // where their open jobs are, busiest first
  openJobs: number;
  totalJobs: number;
};

/** Cities a professional serves: the cities of their regions plus the extra cities. */
function coverage(p: Professional): Set<string> {
  return new Set([...p.serviceAreaIds.flatMap((id) => find(db.serviceAreas, id).cities), ...p.extraCities]);
}

const toProfessionalRow = (p: Professional): ProfessionalRow => {
  const jobs = db.issues.filter((i) => i.professionalId === p.id);
  const open = jobs.filter((i) => isOpen(i.status));
  const byCity = new Map<string, number>();
  for (const i of open) {
    const city = find(db.properties, i.propertyId).city;
    byCity.set(city, (byCity.get(city) ?? 0) + 1);
  }
  return {
    ...p,
    areas: p.serviceAreaIds.map((id) => find(db.serviceAreas, id)),
    coverage: [...coverage(p)].sort((a, b) => a.localeCompare(b, "he")),
    workingNow: [...byCity].map(([city, n]) => ({ city, jobs: n })).sort((a, b) => b.jobs - a.jobs),
    openJobs: open.length,
    totalJobs: jobs.length,
  };
};

export type ProfessionalFilter = { trade?: IssueCategory; city?: string; q?: string };

export function listProfessionals(filter: ProfessionalFilter = {}): Promise<ProfessionalRow[]> {
  const q = filter.q?.trim().toLowerCase();
  return delay(
    db.professionals
      .filter((p) => !filter.trade || p.trades.includes(filter.trade))
      .filter((p) => !filter.city || coverage(p).has(filter.city))
      .filter((p) => !q || `${p.name} ${p.contactName ?? ""} ${p.phone}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.number - b.number)
      .map(toProfessionalRow),
  );
}

/** Every city that appears on a property or in a service area, for filters and pickers. */
export function listCities(): Promise<string[]> {
  const cities = new Set([
    ...db.properties.map((p) => p.city),
    ...db.serviceAreas.flatMap((a) => a.cities),
    ...db.professionals.flatMap((p) => p.extraCities),
  ]);
  return delay([...cities].sort((a, b) => a.localeCompare(b, "he")));
}

export type ProfessionalDetail = { professional: ProfessionalRow; issues: IssueRow[]; totalCostMinor: number };

export function getProfessional(id: ID): Promise<ProfessionalDetail> {
  const jobs = db.issues.filter((i) => i.professionalId === id);
  return delay({
    professional: toProfessionalRow(find(db.professionals, id)),
    issues: jobs.map(toIssueRow).sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    totalCostMinor: jobs.reduce((sum, i) => sum + (i.actualCostMinor ?? 0), 0),
  });
}

export type ProfessionalOption = ProfessionalRow & { matchesTrade: boolean; matchesArea: boolean; nearbyNow: number };

/**
 * Active professionals for an issue, best first: right trade, serves the property's city, and already
 * working in that city now (open jobs there), then by rating.
 */
export function professionalOptions(issueId: ID): Promise<ProfessionalOption[]> {
  const issue = find(db.issues, issueId);
  const city = find(db.properties, issue.propertyId).city;
  const score = (o: ProfessionalOption) => Number(o.matchesTrade) * 4 + Number(o.matchesArea) * 2 + Number(o.nearbyNow > 0);
  const options = db.professionals
    .filter((p) => p.active)
    .map((p) => {
      const row = toProfessionalRow(p);
      return {
        ...row,
        matchesTrade: p.trades.includes(issue.category),
        matchesArea: coverage(p).has(city),
        // Jobs elsewhere in the city; this issue itself does not count.
        nearbyNow: db.issues.filter((i) => i.professionalId === p.id && i.id !== issue.id && isOpen(i.status) && find(db.properties, i.propertyId).city === city).length,
      };
    })
    .sort((a, b) => score(b) - score(a) || (b.rating ?? 0) - (a.rating ?? 0));
  return delay(options);
}

export function listServiceAreas(): Promise<ServiceArea[]> {
  return delay(db.serviceAreas);
}

/** Sets or clears the professional on an issue and records it in the issue's history. */
export function setIssueProfessional(issueId: ID, professionalId: ID | undefined): Promise<void> {
  const issue = find(db.issues, issueId);
  if (professionalId) {
    const pro = find(db.professionals, professionalId);
    // Rejected like a failed API call, not thrown, so callers handle both the same way.
    if (!pro.active) return Promise.reject(new Error("Inactive professionals cannot be assigned"));
  }
  if (issue.professionalId === professionalId) return delay(undefined);
  issue.professionalId = professionalId;
  db.issueEvents.push({
    id: `e${db.issueEvents.length + 1}-${Date.now()}`,
    issueId,
    kind: "professional",
    actor: { type: "user", id: "u1" }, // the signed-in user, once auth exists
    professionalId,
    internal: true,
    at: new Date().toISOString(),
  });
  return delay(undefined);
}

// ---------- form templates ----------

export function listFormTemplates(): Promise<FormTemplate[]> {
  return delay([...db.formTemplates].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "he")));
}

export function getFormTemplate(id: ID): Promise<FormTemplate> {
  return delay(structuredClone(find(db.formTemplates, id)));
}

export function saveFormTemplate(input: Omit<FormTemplate, "id" | "updatedAt"> & { id?: ID }): Promise<FormTemplate> {
  const saved: FormTemplate = { ...input, id: input.id ?? `ft${Date.now()}`, updatedAt: new Date().toISOString() };
  const index = db.formTemplates.findIndex((t) => t.id === saved.id);
  if (index >= 0) db.formTemplates[index] = saved;
  else db.formTemplates.push(saved);
  return delay(saved);
}

/** The records a form of this type can be generated from, for the picker. */
export function listFormRecords(context: FormContext): Promise<{ id: ID; label: string }[]> {
  const rows: Record<FormContext, () => { id: ID; label: string }[]> = {
    lease: () =>
      db.leases
        .map(toLeaseRow)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((l) => ({ id: l.id, label: `${l.tenant.name} · ${propertyLabel(l.property)}, ${l.property.city} · ${l.startDate}` })),
    property: () => treeOrder(db.properties).map(({ property: p, depth }) => ({ id: p.id, label: `${"— ".repeat(depth)}${propertyLabel(p)}, ${p.city}` })),
    customer: () => db.customers.map((c) => ({ id: c.id, label: c.name })),
    tenant: () => db.tenants.map((t) => ({ id: t.id, label: t.name })),
    issue: () => db.issues.map((i) => ({ id: i.id, label: `#${i.number} ${i.title}` })).sort((a, b) => b.label.localeCompare(a.label)),
    payment_request: () => db.paymentRequests.map((r) => ({ id: r.id, label: `#${r.number} · ${find(db.customers, r.customerId).name}` })),
  };
  return delay(rows[context]());
}

/** The values for a template's placeholders, formatted in the form's language. */
function formValues(context: FormContext, recordId: ID, locale: Locale): Record<string, string | undefined> {
  const t = dictionaries[locale];
  const fmt = formatters(locale);
  const company = {
    "company.name": db.organization.name,
    "company.phone": fmt.phone(db.organization.phone),
    "company.email": db.organization.email,
    "company.address": db.organization.address,
    "company.bankDetails": db.organization.bankDetails,
    today: fmt.date(today()),
  };
  const property = (p: Property) => {
    const owner = managingCustomer(p.id);
    return {
      "property.fullAddress": `${propertyLabel(p)}, ${p.city}`,
      "property.address": p.address,
      "property.city": p.city,
      "property.unit": p.unit,
      "property.floor": p.floor?.toString(),
      "property.kind": t.propertyKinds[p.kind],
      "property.area": p.areaSqm?.toString(),
      "property.rooms": p.rooms?.toString(),
      "property.number": String(p.number),
      "property.partOf": ancestors(p).map(propertyLabel).join(" › ") || undefined,
      "owner.name": owner?.name,
      "owner.phone": owner && fmt.phone(owner.phone),
      "owner.email": owner?.email,
      "owner.taxId": owner?.taxId,
    };
  };
  const customer = (c: Customer) => ({
    "customer.name": c.name,
    "customer.number": String(c.number),
    "customer.phone": fmt.phone(c.phone),
    "customer.email": c.email,
    "customer.taxId": c.taxId,
    "customer.billingAddress": c.billingAddress,
  });
  const tenant = (tn: Tenant) => ({ "tenant.name": tn.name, "tenant.phone": fmt.phone(tn.phone), "tenant.email": tn.email, "tenant.taxId": tn.taxId });

  switch (context) {
    case "lease": {
      const l = find(db.leases, recordId);
      return {
        ...company,
        ...property(find(db.properties, l.propertyId)),
        ...tenant(find(db.tenants, l.tenantId)),
        "lease.start": fmt.date(l.startDate),
        "lease.end": fmt.date(l.endDate),
        "lease.rent": fmt.money(l.monthlyRentMinor),
      };
    }
    case "property":
      return { ...company, ...property(find(db.properties, recordId)) };
    case "customer":
      return { ...company, ...customer(find(db.customers, recordId)) };
    case "tenant":
      return { ...company, ...tenant(find(db.tenants, recordId)) };
    case "issue": {
      const i = toIssueRow(find(db.issues, recordId));
      return {
        ...company,
        ...property(i.property),
        "issue.number": `#${i.number}`,
        "issue.title": i.title,
        "issue.description": i.description,
        "issue.category": t.categories[i.category],
        "issue.location": i.location,
        "issue.urgency": t.urgency[i.urgency],
        "issue.opened": fmt.date(i.openedAt),
        "professional.name": i.professional?.name,
        "professional.phone": i.professional && fmt.phone(i.professional.phone),
      };
    }
    case "payment_request": {
      const r = find(db.paymentRequests, recordId);
      return {
        ...company,
        ...customer(find(db.customers, r.customerId)),
        "request.number": String(r.number),
        "request.description": r.description,
        "request.amount": fmt.money(r.amountMinor),
        "request.paid": fmt.money(r.paidMinor),
        "request.balance": fmt.money(r.amountMinor - r.paidMinor),
        "request.due": fmt.date(r.dueDate),
      };
    }
  }
}

export function getFormValues(context: FormContext, recordId: ID, locale: Locale): Promise<Record<string, string | undefined>> {
  return delay(formValues(context, recordId, locale));
}

// ---------- payment requests and automatic reminders ----------
// The reminder job below is what the worker runs once a day (Procrastinate task in apps/worker).
// It is idempotent: a reminder rule fires at most once per payment request.

const balance = (r: PaymentRequest) => r.amountMinor - r.paidMinor;
const stopsReminders = (r: PaymentRequest) => r.status === "paid" || r.status === "cancelled" || r.status === "paused" || balance(r) <= 0;
const ruleDate = (r: PaymentRequest, rule: ReminderRule) => addDays(rule.anchor === "issue_date" ? r.issueDate : r.dueDate, rule.offsetDays);

/** The channel a reminder goes out on: the rule's channel, or the customer's preferred one; WhatsApp when there is no email. */
function resolveChannel(customer: Customer, wanted: Channel | "preferred"): Channel {
  const channel = wanted === "preferred" ? (customer.preferredChannel === "email" ? "email" : "whatsapp") : wanted;
  return channel === "email" && !customer.email ? "whatsapp" : channel;
}

/** Rules not yet sent for this request, in date order. A rule dated before the request was issued never applies. */
function pendingReminders(r: PaymentRequest) {
  const sent = db.outgoingMessages.filter((m) => m.paymentRequestId === r.id);
  const lastSent = sent.reduce((max, m) => (m.at > max ? m.at : max), "");
  return db.reminderRules
    .filter((rule) => rule.active && !sent.some((m) => m.ruleId === rule.id))
    .map((rule) => ({ rule, date: ruleDate(r, rule) }))
    .filter(({ date }) => date >= r.issueDate && (!lastSent || date > lastSent.slice(0, 10)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function composeMessage(r: PaymentRequest, templateId: ID, channel: Channel, ruleId: ID | undefined, at: string, status: OutgoingMessage["status"]) {
  const customer = find(db.customers, r.customerId);
  const template = find(db.formTemplates, templateId);
  const language = template.body[customer.preferredLanguage] ? customer.preferredLanguage : "he";
  const body = render(template.body[language] ?? "", "payment_request", formValues("payment_request", r.id, language)).text;
  const message: OutgoingMessage = {
    id: `m${db.outgoingMessages.length + 1}`,
    paymentRequestId: r.id,
    customerId: customer.id,
    ruleId,
    channel,
    to: channel === "email" ? customer.email! : customer.phone,
    body,
    status,
    at,
  };
  db.outgoingMessages.push(message);
  if (r.status === "scheduled") r.status = "sent";
  return message;
}

/**
 * Sends the reminders due on `on`: email goes out directly; WhatsApp is not integrated, so a
 * WhatsApp message is prepared as "ready" and sent by hand from a pre-filled chat. When several rules are due at once (the job did not run for a
 * few days, or a rule was just enabled), only the latest is sent, so a customer never receives a
 * "due in 3 days" message after the due date.
 */
export function runReminderJob(on: string, sentAt = new Date().toISOString()) {
  for (const r of db.paymentRequests) {
    if (stopsReminders(r) || r.issueDate > on) continue;
    const due = pendingReminders(r).filter((p) => p.date <= on);
    const latest = due[due.length - 1];
    if (!latest) continue;
    const channel = resolveChannel(find(db.customers, r.customerId), latest.rule.channel);
    // Sample replay of past days assumes WhatsApp messages were sent by hand on the day.
    const status = on < today() ? (channel === "whatsapp" ? "sent" : "delivered") : channel === "whatsapp" ? "ready" : "sent";
    composeMessage(r, latest.rule.templateId, channel, latest.rule.id, sentAt, status);
  }
}

// Sample only: replay the job for every past day, as if the worker had been running all along.
// Paid and paused requests were open until just after their due date, so they got reminders until then.
(function backfillSampleMessages() {
  const final = new Map(db.paymentRequests.map((r) => [r.id, { status: r.status, paidMinor: r.paidMinor }]));
  for (const r of db.paymentRequests) {
    if (r.status === "paid" || r.status === "paused") Object.assign(r, { status: "sent", paidMinor: 0 });
  }
  const first = db.paymentRequests.reduce((min, r) => (r.issueDate < min ? r.issueDate : min), today());
  for (let day = first; day <= today(); day = addDays(day, 1)) {
    for (const r of db.paymentRequests) if (day > r.dueDate) Object.assign(r, final.get(r.id));
    runReminderJob(day, `${day}T06:00:00.000Z`);
  }
  // A scheduled request the job has already sent stays "sent"; everything else keeps its sample status.
  for (const r of db.paymentRequests) if (final.get(r.id)!.status !== "scheduled") Object.assign(r, final.get(r.id));
})();

export type PaymentRequestRow = PaymentRequest & {
  customer: Customer;
  property?: Property;
  balanceMinor: number;
  overdueDays: number; // 0 when not overdue
  nextReminder?: { date: string; channel: Channel; templateName: string };
  messages: OutgoingMessage[]; // newest first
  ready?: OutgoingMessage; // a WhatsApp message waiting to be sent by hand
};

function toPaymentRequestRow(r: PaymentRequest): PaymentRequestRow {
  const customer = find(db.customers, r.customerId);
  const [next] = stopsReminders(r) ? [] : pendingReminders(r).filter((p) => p.date >= today());
  const overdueDays = balance(r) > 0 && r.status !== "cancelled" ? Math.max(0, daysBetween(r.dueDate, today())) : 0;
  return {
    ...r,
    customer,
    property: r.propertyId ? find(db.properties, r.propertyId) : undefined,
    balanceMinor: balance(r),
    overdueDays,
    nextReminder: next && {
      date: next.date,
      channel: resolveChannel(customer, next.rule.channel),
      templateName: find(db.formTemplates, next.rule.templateId).name,
    },
    messages: db.outgoingMessages.filter((m) => m.paymentRequestId === r.id).sort((a, b) => b.at.localeCompare(a.at)),
    ready: db.outgoingMessages.find((m) => m.paymentRequestId === r.id && m.status === "ready"),
  };
}

export type PaymentRequestFilter = { status?: "open" | "overdue" | "all"; customerId?: ID };

export function listPaymentRequests(filter: PaymentRequestFilter = {}): Promise<PaymentRequestRow[]> {
  const rows = db.paymentRequests
    .filter((r) => !filter.customerId || r.customerId === filter.customerId)
    .map(toPaymentRequestRow)
    .filter((r) => {
      if (filter.status === "open") return r.balanceMinor > 0 && r.status !== "cancelled";
      if (filter.status === "overdue") return r.overdueDays > 0;
      return true;
    })
    .sort((a, b) => b.overdueDays - a.overdueDays || a.dueDate.localeCompare(b.dueDate));
  return delay(rows);
}

export type ReminderRuleRow = ReminderRule & { template: FormTemplate };

export function listReminderRules(): Promise<ReminderRuleRow[]> {
  const order = (r: ReminderRule) => (r.anchor === "issue_date" ? -1000 : 0) + r.offsetDays;
  return delay(
    [...db.reminderRules].sort((a, b) => order(a) - order(b)).map((r) => ({ ...r, template: find(db.formTemplates, r.templateId) })),
  );
}

export function setReminderRuleActive(id: ID, active: boolean): Promise<void> {
  find(db.reminderRules, id).active = active;
  return delay(undefined);
}

/** Sends a reminder now, outside the schedule: the request itself if not yet sent, otherwise the matching reminder. */
export function sendPaymentReminder(requestId: ID, channel?: Channel): Promise<OutgoingMessage> {
  const r = find(db.paymentRequests, requestId);
  if (stopsReminders(r)) return Promise.reject(new Error("Reminders are stopped for this request"));
  const customer = find(db.customers, r.customerId);
  const templateId = r.status === "scheduled" ? "mt1" : r.dueDate < today() ? "mt3" : "mt2";
  const resolved = channel ?? resolveChannel(customer, "preferred");
  return delay(composeMessage(r, templateId, resolved, undefined, new Date().toISOString(), resolved === "whatsapp" ? "ready" : "sent"));
}

/** Records that a prepared WhatsApp message was sent by hand. */
export function markMessageSent(messageId: ID): Promise<void> {
  const m = find(db.outgoingMessages, messageId);
  if (m.status === "ready") Object.assign(m, { status: "sent", at: new Date().toISOString() });
  return delay(undefined);
}

export function setPaymentRequestPaused(requestId: ID, paused: boolean, reason?: string): Promise<void> {
  const r = find(db.paymentRequests, requestId);
  r.status = paused ? "paused" : r.paidMinor > 0 ? "partially_paid" : "sent";
  r.pausedReason = paused ? reason : undefined;
  return delay(undefined);
}

// ---------- to-do and dashboard ----------

export type TodoItem =
  | { kind: "urgent_issue"; priority: number; issue: IssueRow }
  | { kind: "approval"; priority: number; issue: IssueRow; waitingDays: number }
  | { kind: "verify_payment"; priority: number; id: ID; customer: Customer; amountMinor: number; reportedAt: string }
  | { kind: "lease_ending"; priority: number; lease: LeaseRow }
  | { kind: "send_whatsapp"; priority: number; message: OutgoingMessage; customer: Customer; requestNumber: number };

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
    ...db.outgoingMessages
      .filter((m) => m.status === "ready")
      .map((m) => ({
        kind: "send_whatsapp" as const,
        priority: 3,
        message: m,
        customer: find(db.customers, m.customerId),
        requestNumber: find(db.paymentRequests, m.paymentRequestId).number,
      })),
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
  // Occupancy counts rentable units only: a building is not a property you lease on its own.
  const units = db.properties.filter((p) => !childrenOf(p.id).length).map((p) => toPropertyRow(p));
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
    occupancy: { occupied: units.filter((p) => p.occupancy === "occupied").length, vacant: units.filter((p) => p.occupancy === "vacant").length },
  });
}

export type SearchResult = { kind: "customer" | "property" | "tenant" | "issue" | "professional"; id: ID; label: string; sub: string };

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
      .map((p) => ({ kind: "property" as const, id: p.id, label: propertyLabel(p), sub: p.city })),
    ...db.tenants
      .filter((t) => t.name.toLowerCase().includes(q) || phoneHit(t.phone))
      .map((t) => ({ kind: "tenant" as const, id: t.id, label: t.name, sub: `#${t.number}` })),
    ...db.professionals
      .filter((p) => `${p.name} ${p.contactName ?? ""}`.toLowerCase().includes(q) || phoneHit(p.phone))
      .map((p) => ({ kind: "professional" as const, id: p.id, label: p.name, sub: `#${p.number}` })),
    ...db.issues
      .filter((i) => String(i.number).includes(q.replace("#", "")) || i.title.toLowerCase().includes(q))
      .map((i) => ({ kind: "issue" as const, id: i.id, label: `#${i.number} ${i.title}`, sub: find(db.properties, i.propertyId).address })),
  ];
  return delay(results.slice(0, 12));
}
