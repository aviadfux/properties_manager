// Form and message templates: plain text with {{placeholders}} and a few line markers.
// Pure functions with no data access, so the backend can run the same rules (Python port in
// apps/api/core) when it generates documents and sends messages.
//
// Line markers (for documents; messages are sent as plain text):
//   # Title    ## Section    ### Subsection    - bullet    [ ] checkbox    --- divider
// Underscores ("______") are kept as blanks to fill in by hand.
import type { FormContext } from "@/domain/types";

const COMPANY = ["company.name", "company.taxId", "company.representative", "company.phone", "company.email", "company.address", "company.bankDetails", "today"];
const PROPERTY = [
  "property.fullAddress",
  "property.address",
  "property.city",
  "property.unit",
  "property.floor",
  "property.kind",
  "property.area",
  "property.rooms",
  "property.number",
  "property.partOf",
  "property.block",
  "property.parcel",
];
const OWNER = ["owner.name", "owner.phone", "owner.email", "owner.taxId"];
const CUSTOMER = ["customer.name", "customer.number", "customer.phone", "customer.email", "customer.taxId", "customer.billingAddress"];
const TENANT = ["tenant.name", "tenant.phone", "tenant.email", "tenant.taxId"];
const LEASE = ["lease.start", "lease.end", "lease.rent"];
const ISSUE = ["issue.number", "issue.title", "issue.description", "issue.category", "issue.location", "issue.urgency", "issue.opened"];
const PROFESSIONAL = ["professional.name", "professional.phone"];
const AGREEMENT = [
  "agreement.number",
  "agreement.start",
  "agreement.end",
  "agreement.fee",
  "agreement.billing",
  "agreement.approvalThreshold",
  "agreement.properties",
  "agreement.owners",
];
const REQUEST = ["request.number", "request.description", "request.amount", "request.paid", "request.balance", "request.due"];

/** The placeholders each record type can fill. */
export const FIELDS: Record<FormContext, string[]> = {
  lease: [...LEASE, ...TENANT, ...PROPERTY, ...OWNER, ...COMPANY],
  property: [...PROPERTY, ...OWNER, ...COMPANY],
  customer: [...CUSTOMER, ...COMPANY],
  tenant: [...TENANT, ...COMPANY],
  issue: [...ISSUE, ...PROPERTY, ...OWNER, ...PROFESSIONAL, ...COMPANY],
  payment_request: [...REQUEST, ...CUSTOMER, ...COMPANY],
  // The main property's fields too, for documents about one property (a power of attorney, a quote).
  agreement: [...AGREEMENT, ...CUSTOMER, ...PROPERTY, ...COMPANY],
};

/** Fields whose value may span lines (a list of properties, a description); all others are one line. */
const MULTILINE = new Set(["agreement.properties", "agreement.owners", "issue.description"]);

/**
 * The fields an agreement template needs so that the document states every detail of the record and
 * can be imported back (checked when the template is edited, and on every generated agreement).
 */
export const AGREEMENT_REQUIRED = [
  "customer.name",
  "customer.taxId",
  "customer.phone",
  "customer.email",
  "customer.billingAddress",
  "agreement.start",
  "agreement.end",
  "agreement.fee",
  "agreement.billing",
  "agreement.approvalThreshold",
  "agreement.properties",
];

/** Required fields the template body does not use. */
export const missingRequired = (body: string, required: string[]) => required.filter((key) => !new RegExp(`\\{\\{\\s*${key.replace(".", "\\.")}\\s*\\}\\}`).test(body));

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export type Rendered = { text: string; missing: string[]; unknown: string[] };

/**
 * Replaces {{key}} with its value. A known field without a value becomes "—" and is reported in
 * `missing`; a key the record type does not offer is left as written and reported in `unknown`.
 */
export function render(body: string, context: FormContext, values: Record<string, string | undefined>): Rendered {
  const known = new Set(FIELDS[context]);
  const missing = new Set<string>();
  const unknown = new Set<string>();
  const text = body.replace(PLACEHOLDER, (whole, key: string) => {
    if (!known.has(key)) {
      unknown.add(key);
      return whole;
    }
    // A value is inserted as plain text: a line break inside a one-line field (a name pasted with an
    // Enter) must not start a new heading or bullet in the document. Values are never expanded again,
    // so a "{{…}}" inside a value stays as written.
    const raw = values[key];
    const value = raw === undefined ? undefined : MULTILINE.has(key) ? raw.trim() : raw.replace(/\s*[\r\n]+\s*/g, " ").trim();
    if (value === undefined || value === "") {
      missing.add(key);
      return "—";
    }
    return value;
  });
  return { text, missing: [...missing], unknown: [...unknown] };
}

export type Block =
  | { type: "title" | "section" | "subsection" | "paragraph" | "bullet"; text: string }
  | { type: "checkbox"; text: string }
  | { type: "divider" };

/** Splits rendered text into blocks for the printable view. */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) blocks.push({ type: "subsection", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ type: "section", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ type: "title", text: line.slice(2) });
    else if (line.startsWith("- ")) blocks.push({ type: "bullet", text: line.slice(2) });
    else if (/^\[\s?\]\s/.test(line)) blocks.push({ type: "checkbox", text: line.replace(/^\[\s?\]\s/, "") });
    else if (/^-{3,}$/.test(line.trim())) blocks.push({ type: "divider" });
    else blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}
