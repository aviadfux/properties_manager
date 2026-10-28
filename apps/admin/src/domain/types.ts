// Entities from docs/DATA_MODEL.md. Once the Python API exists, these types are generated
// from its OpenAPI schema instead of written by hand.

export type ID = string;
export type ISODate = string; // "2026-10-28"
export type ISODateTime = string; // UTC, "2026-10-28T09:30:00Z"

export type Language = "he" | "en";
export type PartyKind = "individual" | "company";

export type Customer = {
  id: ID;
  number: number;
  kind: PartyKind;
  name: string;
  taxId?: string;
  phone: string;
  email?: string;
  billingAddress?: string;
  preferredLanguage: Language;
  preferredChannel: "whatsapp" | "email" | "phone";
  status: "active" | "inactive";
  notes?: string;
};

export type PropertyKind = "apartment" | "office" | "shop" | "commercial" | "other";

export type Property = {
  id: ID;
  number: number;
  kind: PropertyKind;
  address: string;
  city: string;
  unit?: string;
  floor?: number;
  areaSqm?: number;
  rooms?: number;
  notes?: string;
};

export type Ownership = {
  id: ID;
  customerId: ID;
  propertyId: ID;
  sharePercent: number;
  startDate: ISODate;
  endDate?: ISODate;
};

export type Tenant = {
  id: ID;
  number: number;
  kind: PartyKind;
  name: string;
  taxId?: string;
  phone: string;
  email?: string;
  preferredLanguage: Language;
  notes?: string;
};

export type Lease = {
  id: ID;
  propertyId: ID;
  tenantId: ID;
  startDate: ISODate;
  endDate: ISODate;
  monthlyRentMinor: number;
  currency: "ILS";
};

export type IssueCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "structural"
  | "appliances"
  | "pests"
  | "locks"
  | "elevator"
  | "cleaning"
  | "other";

export type Urgency = "low" | "normal" | "high" | "emergency";

export const ISSUE_STATUSES = [
  "new",
  "under_review",
  "awaiting_quote",
  "awaiting_approval",
  "approved",
  "scheduled",
  "in_progress",
  "awaiting_signoff",
  "closed",
  "cancelled",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const isOpen = (s: IssueStatus) => s !== "closed" && s !== "cancelled";

export type ActorRef = { type: "customer" | "tenant" | "user"; id: ID };

export type Issue = {
  id: ID;
  number: number;
  propertyId: ID;
  customerId: ID; // snapshot of the managing customer when the issue was opened
  reporter: ActorRef;
  assigneeId?: ID;
  title: string;
  description: string;
  category: IssueCategory;
  location?: string;
  urgency: Urgency;
  status: IssueStatus;
  openedAt: ISODateTime;
  closedAt?: ISODateTime;
  resolution?: string;
  actualCostMinor?: number;
};

export type IssueEvent = {
  id: ID;
  issueId: ID;
  kind: "status" | "note" | "attachment" | "assignment";
  actor: ActorRef;
  fromStatus?: IssueStatus;
  toStatus?: IssueStatus;
  body?: string;
  internal: boolean;
  at: ISODateTime;
};

export type User = {
  id: ID;
  name: string;
  email: string;
  role: "managing_director" | "property_manager" | "operations" | "finance" | "accountant";
  active: boolean;
};

// --- Not yet in the data model (Phase 2: billing). Sample-only shapes for the dashboard. ---

export type CollectionsSummary = {
  month: ISODate; // first day of the month
  dueMinor: number;
  verifiedMinor: number;
  unverifiedMinor: number; // reported by customers, not yet verified (never counted as collected)
  updatedAt: ISODateTime;
};

export type DebtAging = { bucket: "0-30" | "31-60" | "61-90" | "90+"; amountMinor: number; customers: number }[];

export type PaymentToVerify = {
  id: ID;
  customerId: ID;
  amountMinor: number;
  reportedAt: ISODateTime;
  method: "bank_transfer" | "cheque";
};
