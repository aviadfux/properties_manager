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

export const PROPERTY_KINDS = ["complex", "building", "apartment", "office", "shop", "commercial", "parking", "storage", "other"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

/** Kinds that usually group other properties; any property may still have children. */
export const isContainerKind = (k: PropertyKind) => k === "complex" || k === "building";

export type Property = {
  id: ID;
  number: number;
  kind: PropertyKind;
  parentId?: ID; // the property this one is part of (a unit in a building, a building in a complex)
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
  professionalId?: ID; // the professional doing the work, optional
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
  kind: "status" | "note" | "attachment" | "assignment" | "professional";
  actor: ActorRef;
  professionalId?: ID; // for "professional" events; empty when the professional was removed
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

/** A region the organization works in, made of cities (e.g. Gush Dan). */
export type ServiceArea = {
  id: ID;
  name: string;
  cities: string[];
};

export type Professional = {
  id: ID;
  number: number;
  kind: PartyKind;
  name: string; // business name, or the person's name
  contactName?: string;
  taxId?: string;
  phone: string;
  email?: string;
  trades: IssueCategory[]; // the kinds of issues they handle
  serviceAreaIds: ID[]; // regions they serve
  extraCities: string[]; // single cities served outside those regions
  rating?: 1 | 2 | 3 | 4 | 5;
  active: boolean;
  notes?: string;
};

// --- Form templates ---

export type FormContext = "lease" | "property" | "customer" | "tenant" | "issue" | "payment_request";

export type FormTemplate = {
  id: ID;
  name: string;
  context: FormContext; // which record the form is generated from
  kind: "document" | "message"; // a printable form, or the text of a WhatsApp / email message
  body: Partial<Record<Language, string>>; // text with {{placeholders}} per language; see src/data/templates.ts
  updatedAt: ISODateTime;
};

// --- Payment requests and automatic reminders (Phase 2: billing; sample-only until then) ---

export type Channel = "whatsapp" | "email";

export type PaymentRequestStatus = "scheduled" | "sent" | "partially_paid" | "paid" | "paused" | "cancelled";

export type PaymentRequest = {
  id: ID;
  number: number;
  customerId: ID;
  propertyId?: ID;
  description: string;
  amountMinor: number;
  paidMinor: number;
  currency: "ILS";
  issueDate: ISODate; // when the request is sent
  dueDate: ISODate;
  status: PaymentRequestStatus;
  pausedReason?: string; // e.g. a dispute; reminders stop until resumed
};

/** One step of the reminder schedule: days relative to the due date (-3 = three days before). */
export type ReminderRule = {
  id: ID;
  anchor: "issue_date" | "due_date"; // issue_date + 0 is the payment request itself
  offsetDays: number;
  channel: Channel | "preferred"; // "preferred" uses the customer's preferred channel
  templateId: ID;
  active: boolean;
};

export type OutgoingMessage = {
  id: ID;
  paymentRequestId: ID;
  customerId: ID;
  ruleId?: ID; // empty when sent by hand
  channel: Channel;
  to: string;
  body: string;
  // WhatsApp is not integrated: a WhatsApp message is prepared as "ready" and sent by hand
  // from a pre-filled chat (wa.me link); email is sent by the system.
  status: "ready" | "queued" | "sent" | "delivered" | "failed";
  at: ISODateTime;
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
