// Form and message templates: plain text with {{placeholders}} and a few line markers.
// Pure functions with no data access, so the backend can run the same rules (Python port in
// apps/api/core) when it generates documents and sends messages.
//
// Line markers (for documents; messages are sent as plain text):
//   # Title        ## Section        - bullet        [ ] checkbox        --- divider
// Underscores ("______") are kept as blanks to fill in by hand.
import type { FormContext } from "@/domain/types";

const COMPANY = ["company.name", "company.phone", "company.email", "company.address", "company.bankDetails", "today"];
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
];
const OWNER = ["owner.name", "owner.phone", "owner.email", "owner.taxId"];
const CUSTOMER = ["customer.name", "customer.number", "customer.phone", "customer.email", "customer.taxId", "customer.billingAddress"];
const TENANT = ["tenant.name", "tenant.phone", "tenant.email", "tenant.taxId"];
const LEASE = ["lease.start", "lease.end", "lease.rent"];
const ISSUE = ["issue.number", "issue.title", "issue.description", "issue.category", "issue.location", "issue.urgency", "issue.opened"];
const PROFESSIONAL = ["professional.name", "professional.phone"];
const REQUEST = ["request.number", "request.description", "request.amount", "request.paid", "request.balance", "request.due"];

/** The placeholders each record type can fill. */
export const FIELDS: Record<FormContext, string[]> = {
  lease: [...LEASE, ...TENANT, ...PROPERTY, ...OWNER, ...COMPANY],
  property: [...PROPERTY, ...OWNER, ...COMPANY],
  customer: [...CUSTOMER, ...COMPANY],
  tenant: [...TENANT, ...COMPANY],
  issue: [...ISSUE, ...PROPERTY, ...OWNER, ...PROFESSIONAL, ...COMPANY],
  payment_request: [...REQUEST, ...CUSTOMER, ...COMPANY],
};

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
    const value = values[key];
    if (value === undefined || value === "") {
      missing.add(key);
      return "—";
    }
    return value;
  });
  return { text, missing: [...missing], unknown: [...unknown] };
}

export type Block =
  | { type: "title" | "section" | "paragraph" | "bullet"; text: string }
  | { type: "checkbox"; text: string }
  | { type: "divider" };

/** Splits rendered text into blocks for the printable view. */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) blocks.push({ type: "section", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ type: "title", text: line.slice(2) });
    else if (line.startsWith("- ")) blocks.push({ type: "bullet", text: line.slice(2) });
    else if (/^\[\s?\]\s/.test(line)) blocks.push({ type: "checkbox", text: line.replace(/^\[\s?\]\s/, "") });
    else if (/^-{3,}$/.test(line.trim())) blocks.push({ type: "divider" });
    else blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}
