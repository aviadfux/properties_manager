// Checks that decide whether imported or entered details may be saved, and whether an exported
// document says what the record says. The screens show them; the data layer (the API later)
// enforces them, so the same rules hold whoever calls. Pure functions, ported to apps/api/core.
//
// "error"   – cannot be saved like this.
// "warning" – may be right, but a person should look (an ID with a wrong check digit may be a
//             foreign passport; a property owned by someone else may be about to change hands).
import type { FeeModel, ManagementAgreement, PartyKind } from "@/domain/types";
import { isValidIsraeliId } from "@/security/sensitive";
import { EMAIL_FORMAT, normalizePhone, parseDate, type AgreementExtract } from "./agreements";

export type CheckCode =
  | "name_missing"
  | "name_too_long"
  | "phone_missing"
  | "phone_invalid"
  | "email_invalid"
  | "tax_id_invalid"
  | "tax_id_not_digits"
  | "start_missing"
  | "start_invalid"
  | "end_invalid"
  | "end_before_start"
  | "fee_missing"
  | "fee_out_of_range"
  | "fee_unusual"
  | "threshold_invalid"
  | "no_properties"
  | "property_unmatched"
  | "property_other_owner"
  | "property_in_other_agreement"
  | "duplicate_agreement"
  | "duplicate_customer";

export type Check = { code: CheckCode; level: "error" | "warning"; detail?: string };

export const hasErrors = (checks: Check[]) => checks.some((c) => c.level === "error");

const MAX_FIXED_FEE_MINOR = 1_000_000_00; // ₪1,000,000 a month: anything above is a typo

export type CustomerFields = { kind: PartyKind; name: string; phone: string; email?: string; taxId?: string };

export function checkCustomer(d: CustomerFields): Check[] {
  const checks: Check[] = [];
  const name = d.name.trim();
  if (!name || !/[א-תa-z]/i.test(name)) checks.push({ code: "name_missing", level: "error" });
  else if (name.length > 120) checks.push({ code: "name_too_long", level: "error" });
  if (!d.phone.trim()) checks.push({ code: "phone_missing", level: "error" });
  else if (!normalizePhone(d.phone)) checks.push({ code: "phone_invalid", level: "error" });
  if (d.email?.trim() && !EMAIL_FORMAT.test(d.email.trim())) checks.push({ code: "email_invalid", level: "error" });
  const taxId = d.taxId?.trim();
  if (taxId) {
    if (!/^[\d\s-]+$/.test(taxId)) checks.push({ code: "tax_id_not_digits", level: "warning" }); // e.g. a passport number
    else if (!isValidIsraeliId(taxId)) checks.push({ code: "tax_id_invalid", level: "warning" });
  }
  return checks;
}

export type TermFields = Pick<ManagementAgreement, "startDate" | "endDate" | "feeModel" | "feeMinor" | "feePercent" | "approvalThresholdMinor">;

export function checkTerms(t: TermFields): Check[] {
  const checks: Check[] = [];
  const validIso = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && parseDate(d) === d;
  if (!t.startDate) checks.push({ code: "start_missing", level: "error" });
  else if (!validIso(t.startDate)) checks.push({ code: "start_invalid", level: "error" });
  if (t.endDate && !validIso(t.endDate)) checks.push({ code: "end_invalid", level: "error" });
  else if (t.endDate && t.startDate && t.endDate <= t.startDate) checks.push({ code: "end_before_start", level: "error" });

  // A percentage, an amount, or both (a percentage with a monthly minimum).
  const missing = (n?: number) => n === undefined || n === null || Number.isNaN(n);
  const usesPercent = t.feeModel !== "fixed";
  const usesAmount = t.feeModel !== "percent_of_rent";
  if ((usesPercent && missing(t.feePercent)) || (usesAmount && missing(t.feeMinor))) checks.push({ code: "fee_missing", level: "error" });
  else if (
    (usesPercent && !(t.feePercent! > 0 && t.feePercent! <= 100)) ||
    (usesAmount && (!Number.isInteger(t.feeMinor) || t.feeMinor! < 0 || t.feeMinor! > MAX_FIXED_FEE_MINOR))
  )
    checks.push({ code: "fee_out_of_range", level: "error" });
  else if (usesPercent && t.feePercent! > 30) checks.push({ code: "fee_unusual", level: "warning" });

  const threshold = t.approvalThresholdMinor;
  if (threshold !== undefined && (!Number.isInteger(threshold) || threshold < 0 || threshold > MAX_FIXED_FEE_MINOR * 100))
    checks.push({ code: "threshold_invalid", level: "error" });
  return checks;
}

// ---------- export: does the document say what the record says? ----------

/** What an agreement document must state, taken from the record. */
export type AgreementRecord = {
  name: string;
  taxId?: string;
  phone: string; // E.164
  email?: string;
  billingAddress?: string;
  startDate: string;
  endDate?: string;
  feeModel: FeeModel;
  feePercent?: number;
  feeMinor?: number;
  plusVat: boolean;
  billingFrequency: "monthly" | "quarterly";
  approvalThresholdMinor?: number;
  properties: string[]; // as the document lists them (address, and block and parcel when known)
};

export type ExportField = keyof AgreementRecord;

/**
 * Reads the generated document back with the import rules and lists every field that is missing or
 * different. An empty list means the document states exactly what the record says — and that it can
 * be imported again without corrections.
 */
export function compareWithRecord(expected: AgreementRecord, x: AgreementExtract): ExportField[] {
  const c = x.customer;
  const t = x.terms;
  const norm = (s?: string) => s?.replace(/\s+/g, " ").trim() || undefined;
  const pairs: [ExportField, unknown, unknown][] = [
    ["name", norm(expected.name), norm(c.name?.value)],
    ["taxId", expected.taxId?.replace(/\D/g, "") || undefined, c.taxId?.value],
    ["phone", expected.phone, c.phone?.value],
    ["email", expected.email?.toLowerCase(), c.email?.value],
    ["billingAddress", norm(expected.billingAddress), norm(c.billingAddress?.value)],
    ["startDate", expected.startDate, t.startDate?.value],
    ["endDate", expected.endDate, t.endDate?.value],
    ["feeModel", expected.feeModel, t.feeModel?.value],
    ["feePercent", expected.feePercent, t.feePercent?.value],
    ["feeMinor", expected.feeMinor, t.feeMinor?.value],
    ["plusVat", expected.plusVat, Boolean(t.plusVat?.value)],
    ["billingFrequency", expected.billingFrequency, t.billingFrequency?.value ?? "monthly"],
    ["approvalThresholdMinor", expected.approvalThresholdMinor, t.approvalThresholdMinor?.value],
    ["properties", expected.properties.map(norm).join("\n"), x.properties.map((p) => norm(p.value)).join("\n")],
  ];
  return pairs.filter(([, want, got]) => want !== got).map(([field]) => field);
}
