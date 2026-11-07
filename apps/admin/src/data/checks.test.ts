// The checks that stand between a document and the database.
import { describe, expect, it } from "vitest";
import { extractAgreement } from "./agreements";
import { checkCustomer, checkTerms, compareWithRecord, hasErrors, type AgreementRecord } from "./checks";

const codes = (checks: { code: string }[]) => checks.map((c) => c.code);
const person = { kind: "individual" as const, name: "Dana Katz", phone: "050-765-4321" };
const terms = { startDate: "2026-12-01", feeModel: "percent_of_rent" as const, feePercent: 6 };

describe("customer details", () => {
  it("accepts complete, valid details", () => {
    expect(checkCustomer({ ...person, email: "dana@example.com", taxId: "207654328" })).toEqual([]);
  });

  it.each([
    [{ name: "  " }, "name_missing"],
    [{ name: "12345" }, "name_missing"],
    [{ name: "x".repeat(121) }, "name_too_long"],
    [{ phone: "" }, "phone_missing"],
    [{ phone: "050-765" }, "phone_invalid"],
    [{ email: "dana@" }, "email_invalid"],
    [{ email: "dana@example" }, "email_invalid"],
  ])("refuses %o", (change, code) => {
    const checks = checkCustomer({ ...person, ...change });
    expect(codes(checks)).toEqual([code]);
    expect(hasErrors(checks)).toBe(true);
  });

  it("only warns about an ID it cannot verify (a typo, or a foreign passport)", () => {
    expect(checkCustomer({ ...person, taxId: "207654321" })).toEqual([{ code: "tax_id_invalid", level: "warning" }]);
    expect(checkCustomer({ ...person, taxId: "AB1234567" })).toEqual([{ code: "tax_id_not_digits", level: "warning" }]);
  });
});

describe("agreement terms", () => {
  it("accepts valid terms", () => {
    expect(checkTerms(terms)).toEqual([]);
    expect(checkTerms({ ...terms, feeModel: "percent_with_minimum", feePercent: 8.5, feeMinor: 40000 })).toEqual([]);
    expect(checkTerms({ startDate: "2026-12-01", endDate: "2027-11-30", feeModel: "fixed", feeMinor: 123456, approvalThresholdMinor: 0 })).toEqual([]);
  });

  it.each([
    [{ startDate: "" }, "start_missing"],
    [{ startDate: "2026-02-30" }, "start_invalid"],
    [{ startDate: "1/12/2026" }, "start_invalid"],
    [{ endDate: "2026-13-01" }, "end_invalid"],
    [{ endDate: "2026-12-01" }, "end_before_start"],
    [{ endDate: "2026-11-01" }, "end_before_start"],
    [{ feePercent: undefined }, "fee_missing"],
    [{ feePercent: NaN }, "fee_missing"],
    [{ feePercent: 0 }, "fee_out_of_range"],
    [{ feePercent: 101 }, "fee_out_of_range"],
    [{ feeModel: "fixed" as const, feeMinor: -100 }, "fee_out_of_range"],
    [{ feeModel: "fixed" as const, feeMinor: 10.5 }, "fee_out_of_range"],
    [{ feeModel: "fixed" as const, feeMinor: 1_000_000_01 }, "fee_out_of_range"],
    [{ approvalThresholdMinor: -1 }, "threshold_invalid"],
    [{ feeModel: "percent_with_minimum" as const }, "fee_missing"], // the minimum is missing
    [{ feeModel: "percent_with_minimum" as const, feeMinor: 40000, feePercent: 150 }, "fee_out_of_range"],
  ])("refuses %o", (change, code) => {
    expect(codes(checkTerms({ ...terms, ...change }))).toEqual([code]);
  });

  it("warns about an unusually high percentage without refusing it", () => {
    expect(checkTerms({ ...terms, feePercent: 35 })).toEqual([{ code: "fee_unusual", level: "warning" }]);
  });
});

describe("export check", () => {
  const record: AgreementRecord = {
    name: "Dana Katz",
    taxId: "207654328",
    phone: "+972507654321",
    email: "dana@example.com",
    billingAddress: "Herzl 3, Haifa",
    startDate: "2026-12-01",
    endDate: "2027-11-30",
    feeModel: "percent_of_rent",
    feePercent: 6,
    plusVat: false,
    billingFrequency: "monthly",
    approvalThresholdMinor: 150000,
    properties: ["Herzl 12 / 5, Ramat Gan"],
  };
  const document = `## The owner
Name: Dana Katz
ID / company no.: 207654328
Phone: 050-765-4321
Email: dana@example.com
Address: Herzl 3, Haifa
## Managed properties
- Herzl 12 / 5, Ramat Gan
## Terms
Term: 01/12/2026 – 30/11/2027
Management fee: 6% of the rent
Owner approval threshold: ₪1,500`;
  const own = { name: "Company", phone: "+97235550100", email: "office@example.com" };

  it("passes when the document states exactly the record", () => {
    expect(compareWithRecord(record, extractAgreement(document, own))).toEqual([]);
  });

  // Every field is checked: change any one in the record and the check must name it.
  it.each([
    ["name", { name: "Dana Cohen" }],
    ["taxId", { taxId: "034827139" }],
    ["phone", { phone: "+972507654322" }],
    ["email", { email: "other@example.com" }],
    ["billingAddress", { billingAddress: "Herzl 4, Haifa" }],
    ["startDate", { startDate: "2026-12-02" }],
    ["endDate", { endDate: undefined }],
    ["feePercent", { feePercent: 6.5 }],
    ["feeMinor", { feeMinor: 100 }],
    ["feeModel", { feeModel: "fixed" as const }],
    ["plusVat", { plusVat: true }],
    ["billingFrequency", { billingFrequency: "quarterly" as const }],
    ["approvalThresholdMinor", { approvalThresholdMinor: 150001 }],
    ["properties", { properties: ["Herzl 12 / 5, Ramat Gan", "Bialik 17 / 2, Ramat Gan"] }],
  ])("notices a different %s", (field, change) => {
    expect(compareWithRecord({ ...record, ...change }, extractAgreement(document, own))).toEqual([field]);
  });

  it("notices a detail the template left out", () => {
    const withoutId = document.replace(/^ID.*\n/m, "");
    expect(compareWithRecord(record, extractAgreement(withoutId, own))).toEqual(["taxId"]);
  });
});
