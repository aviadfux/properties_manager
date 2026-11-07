// Business rules of the data layer. These become the acceptance tests of the Python API: the same
// inputs (the sample data) must give the same results once api.ts calls the backend.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, TODAY } from "@/test/utils";

// Some tests change the in-memory data (assigning a professional, sending a reminder), so every
// test starts from freshly loaded sample data.
let api: typeof import("./api");
let db: typeof import("./sample");
beforeEach(async () => {
  vi.resetModules();
  db = await import("./sample");
  api = await import("./api");
});

describe("property hierarchy", () => {
  it("lists parts under their parent, in order, with their depth", async () => {
    const rows = await api.listProperties();
    const complex = rows.findIndex((p) => p.id === "p16");
    expect(rows.slice(complex, complex + 7).map((p) => [p.id, p.depth])).toEqual([
      ["p16", 0],
      ["p8", 1],
      ["p11", 1],
      ["p12", 2],
      ["p13", 2],
      ["p14", 2],
      ["p15", 2],
    ]);
  });

  it("gives units without owners of their own the owners of the whole", async () => {
    const { property } = await api.getProperty("p12");
    expect(property.owners.map((o) => o.customer.id)).toEqual(["c3"]);
    expect(property.ownersFrom?.id).toBe("p16");
  });

  it("prefers a part's own owners over the inherited ones", async () => {
    const { property } = await api.getProperty("p8");
    expect(property.owners.map((o) => o.customer.id)).toEqual(["c3"]);
    expect(property.ownersFrom).toBeUndefined();
  });

  it("derives a container's occupancy from its innermost units", async () => {
    const { property: building } = await api.getProperty("p11");
    expect(building.occupancy).toBe("partial"); // p13 is vacant
    expect(building.units).toEqual({ occupied: 3, total: 4 });
    const { property: complex } = await api.getProperty("p16");
    expect(complex.units).toEqual({ occupied: 4, total: 5 });
  });

  it("shows the chain a property is part of, outermost first", async () => {
    expect((await api.getProperty("p12")).partOf.map((p) => p.id)).toEqual(["p16", "p11"]);
  });

  it("includes the issues of a property's parts", async () => {
    const { issues } = await api.getProperty("p16");
    expect(issues.map((i) => i.propertyId).sort()).toEqual(["p11", "p12", "p13", "p8"]);
  });

  it("counts only units in the dashboard occupancy, not buildings", async () => {
    const { occupancy } = await api.getDashboard();
    const units = db.properties.filter((p) => !db.properties.some((c) => c.parentId === p.id));
    expect(occupancy.occupied + occupancy.vacant).toBe(units.length);
  });

  it("counts everything a customer owns, directly or as part of a whole", async () => {
    const c3 = (await api.listCustomers()).find((c) => c.id === "c3")!;
    expect(c3.properties).toBe(8); // p3, p8, p16 and its building with 4 units
  });
});

describe("history", () => {
  it("lists a property's ownership, leases and issues, newest first", async () => {
    const { history } = await api.getProperty("p1");
    expect(history.events.map((e) => e.kind)).toEqual(["issue", "issue", "lease", "issue", "lease", "ownership"]);
    const dates = history.events.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("sums repair costs and counts tenants and professionals", async () => {
    const { history } = await api.getProperty("p1");
    expect(history.summary).toEqual({ leases: 2, tenants: 2, issues: 3, repairCostMinor: 425_000, professionals: 1 });
  });

  it("includes the history of a building's units", async () => {
    const { history } = await api.getProperty("p11");
    const leased = history.events.flatMap((e) => (e.kind === "lease" ? [e.lease.property.id] : []));
    expect(new Set(leased)).toEqual(new Set(["p12", "p13", "p14", "p15"]));
  });

  it("limits a customer's history to leases during their ownership", async () => {
    // c2 owned p7 until 2015; its later tenants belong to the next owner's history.
    const { history } = await api.getCustomer("c2");
    const ownerships = history.events.filter((e) => e.kind === "ownership");
    expect(ownerships.map((e) => e.property.id).sort()).toEqual(["p2", "p7"]);
    const leases = history.events.flatMap((e) => (e.kind === "lease" ? [e.lease.property.id] : []));
    expect(leases.every((p) => p === "p2")).toBe(true);
  });
});

describe("professionals", () => {
  it("serves the cities of their regions plus their extra cities", async () => {
    const pr2 = (await api.getProfessional("pr2")).professional;
    expect(pr2.coverage).toEqual(expect.arrayContaining(["פתח תקווה", "כפר סבא", "תל אביב"]));
    expect(pr2.coverage).not.toContain("חולון");
  });

  it("finds professionals by a city that is only part of a region", async () => {
    const names = (await api.listProfessionals({ city: "בני ברק" })).map((p) => p.id);
    expect(names).toEqual(expect.arrayContaining(["pr1", "pr4", "pr5"]));
    expect(names).not.toContain("pr2");
  });

  it("knows where each professional is working now", async () => {
    const pr6 = (await api.getProfessional("pr6")).professional;
    expect(pr6.workingNow.map((w) => w.city).sort()).toEqual(["חולון", "פתח תקווה"]);
  });

  it("suggests the right trade in the right area first, then who is already working nearby", async () => {
    const options = await api.professionalOptions("i13"); // elevator, Petah Tikva
    expect(options[0]).toMatchObject({ id: "pr4", matchesTrade: true, matchesArea: true });
    expect(options[1]).toMatchObject({ id: "pr6", matchesTrade: false, matchesArea: true, nearbyNow: 1 });
  });

  it("never offers inactive professionals", async () => {
    expect((await api.professionalOptions("i1")).some((o) => !o.active)).toBe(false);
    await expect(api.setIssueProfessional("i1", "pr7")).rejects.toThrow();
  });

  it("records a change of professional in the issue's history", async () => {
    await api.setIssueProfessional("i1", "pr1");
    const { issue, events } = await api.getIssue("i1");
    expect(issue.professional?.id).toBe("pr1");
    expect(events.at(-1)).toMatchObject({ kind: "professional", professionalId: "pr1", professionalName: "אינסטלציה ש.ב." });
  });
});

describe("form values", () => {
  it("fills a lease form, with the owner inherited from the complex", async () => {
    const values = await api.getFormValues("lease", "l12", "he");
    expect(values).toMatchObject({
      "property.fullAddress": "המלאכה 8 / 1, ראש העין",
      "property.partOf": "קריית המלאכה › המלאכה 8",
      "owner.name": "גלבוע השקעות בע״מ",
      "tenant.name": "פיצה המלאכה",
    });
    expect(values["tenant.email"]).toBeUndefined();
  });

  it("formats values in the form's language", async () => {
    const he = await api.getFormValues("issue", "i1", "he");
    const en = await api.getFormValues("issue", "i1", "en");
    expect(he["issue.category"]).toBe("אינסטלציה");
    expect(en["issue.category"]).toBe("Plumbing");
  });

  it("offers records of the template's type to generate from", async () => {
    expect((await api.listFormRecords("lease")).length).toBe(db.leases.length);
  });
});

describe("payment reminders", () => {
  const row = async (id: string) => (await api.listPaymentRequests({ status: "all" })).find((r) => r.id === id)!;

  it("has sent each scheduled message on its day, by the customer's channel", async () => {
    const r = await row("rq2"); // customer prefers email
    expect(r.messages.map((m) => [m.at.slice(0, 10), m.channel, m.ruleId])).toEqual([
      [addDays(TODAY, -2), "email", "r3"],
      [addDays(TODAY, -5), "email", "r2"],
      [addDays(TODAY, -12), "email", "r1"],
    ]);
  });

  it("shows the next reminder and how overdue a request is", async () => {
    const r = await row("rq1");
    expect(r.overdueDays).toBe(2);
    expect(r.nextReminder).toMatchObject({ date: addDays(TODAY, 5), channel: "whatsapp" });
  });

  it("stops reminders once paid or paused", async () => {
    expect((await row("rq3")).nextReminder).toBeUndefined();
    expect((await row("rq7")).nextReminder).toBeUndefined();
    await expect(api.sendPaymentReminder("rq7")).rejects.toThrow();
  });

  it("does not send anything before the request is issued", async () => {
    const r = await row("rq5");
    expect(r.messages).toEqual([]);
    expect(r.nextReminder?.date).toBe(r.issueDate);
  });

  it("prepares WhatsApp messages for sending by hand and emails directly", async () => {
    const whatsapp = await row("rq4");
    expect(whatsapp.ready).toMatchObject({ channel: "whatsapp", status: "ready", to: "+972503456789" });
    const email = await api.sendPaymentReminder("rq2");
    expect(email).toMatchObject({ channel: "email", status: "sent" });
  });

  it("writes the message in the customer's language", async () => {
    expect((await row("rq4")).ready!.body).toMatch(/^Hello David Miller/);
    expect((await row("rq1")).messages[0].body).toMatch(/^שלום יוסי כהן/);
  });

  it("lists ready WhatsApp messages as things to do until they are marked sent", async () => {
    const todo = async () => (await api.listTodo()).filter((t) => t.kind === "send_whatsapp");
    const [item] = await todo();
    expect(item).toBeDefined();
    await api.markMessageSent(item.kind === "send_whatsapp" ? item.message.id : "");
    expect(await todo()).toEqual([]);
  });

  it("runs once per rule: running the job again the same day sends nothing", async () => {
    const before = db.outgoingMessages.length;
    api.runReminderJob(TODAY);
    expect(db.outgoingMessages.length).toBe(before);
  });

  it("sends only the latest due reminder when the job missed some days", async () => {
    db.paymentRequests.push({
      id: "rqX",
      number: 9999,
      customerId: "c2",
      description: "test",
      amountMinor: 1000,
      paidMinor: 0,
      currency: "ILS",
      issueDate: addDays(TODAY, -10),
      dueDate: addDays(TODAY, -1),
      status: "sent",
    });
    api.runReminderJob(TODAY);
    const sent = db.outgoingMessages.filter((m) => m.paymentRequestId === "rqX");
    expect(sent.map((m) => m.ruleId)).toEqual(["r3"]); // not the request or the "3 days before" reminder
  });

  it("skips inactive rules", async () => {
    await api.setReminderRuleActive("r4", false);
    const r = await row("rq1");
    expect(r.nextReminder?.date).toBe(addDays(TODAY, 12)); // r5 (+14 days), not r4 (+7)
  });
});

describe("management agreements", () => {
  const terms = { propertyIds: ["p5"], startDate: "2026-12-01", feeModel: "percent_of_rent" as const, feePercent: 5, language: "he" as const };
  const owner = { kind: "individual" as const, name: "משה לוי", taxId: "207654328", phone: "+972541234567", email: "moshe@example.com", preferredLanguage: "he" as const };

  it("knows which agreements are drafts, in force or ending", async () => {
    const rows = await api.listAgreements();
    expect(Object.fromEntries(rows.map((a) => [a.id, a.status]))).toEqual({ ag1: "active", ag2: "active", ag3: "active", ag4: "draft" });
    expect((await api.listAgreements({ customerId: "c3" })).map((a) => a.id)).toEqual(["ag2"]);
  });

  it("fills an agreement document from the customer's details", async () => {
    const values = await api.getFormValues("agreement", "ag1", "he");
    expect(values).toMatchObject({
      "customer.name": "יוסי כהן",
      "customer.taxId": "034827139",
      "agreement.start": "01/03/2023",
      "agreement.end": "ללא מועד סיום",
      "agreement.fee": expect.stringMatching(/^8\.5% משכר הדירה או .*400.* לחודש, לפי הגבוה מביניהם בתוספת מע״מ$/),
      "agreement.billing": "בתחילת כל רבעון",
      "property.block": "6123",
      "agreement.properties": "- הרצל 12 / 5, רמת גן (גוש 6123, חלקה 45)\n- ביאליק 17 / 2, רמת גן (גוש 6124, חלקה 112)",
      "agreement.owners": "- יוסי כהן, ת.ז. / ח.פ. 034827139",
    });
  });

  it("creates a draft from a customer's details, and marks it signed", async () => {
    const a = await api.createAgreement({ customerId: "c5", ...terms });
    expect(a).toMatchObject({ number: 3005, source: "generated", feeMinor: undefined });
    expect((await api.getAgreement(a.id)).status).toBe("draft");
    await api.markAgreementSigned(a.id);
    expect((await api.getAgreement(a.id)).status).toBe("upcoming");
  });

  it("rejects agreements that cannot be right", async () => {
    await expect(api.createAgreement({ customerId: "c5", ...terms, endDate: "2026-11-01" })).rejects.toThrow(/end_before_start/);
    await expect(api.createAgreement({ customerId: "c5", ...terms, feePercent: 0 })).rejects.toThrow(/fee_out_of_range/);
    await expect(api.createAgreement({ customerId: "c5", ...terms, startDate: "2026-02-31" })).rejects.toThrow(/start_invalid/);
    await expect(api.createAgreement({ customerId: "nobody", ...terms })).rejects.toThrow(/Unknown customer/);
  });

  it("creates a customer and an agreement from an imported document", async () => {
    const before = db.customers.length;
    const result = await api.importAgreement({ customer: owner, agreement: { ...terms, fileName: "agreement.docx" } });
    expect(result.created).toBe(true);
    expect(db.customers).toHaveLength(before + 1);
    const { customer } = await api.getCustomer(result.customerId);
    expect(customer).toMatchObject({ name: "משה לוי", number: 107, preferredChannel: "email", status: "active" });
    expect(await api.getAgreement(result.agreementId)).toMatchObject({ source: "imported", fileName: "agreement.docx", customerId: result.customerId });
  });

  it("finds an existing customer by ID, email or phone before creating a duplicate", async () => {
    expect((await api.findCustomerMatches({ taxId: "515-123-453" })).map((m) => [m.customer.id, m.by])).toEqual([["c3", "taxId"]]);
    expect((await api.findCustomerMatches({ email: "YOSSI@example.com" }))[0]).toMatchObject({ by: "email", customer: { id: "c1" } });
    expect((await api.findCustomerMatches({ phone: "+972524567890" }))[0]).toMatchObject({ by: "phone", customer: { id: "c5" } });
    expect(await api.findCustomerMatches(owner)).toEqual([]);
  });

  it("fills only missing details of an existing customer, never overwriting", async () => {
    const result = await api.importAgreement({
      customer: { ...owner, name: "רונית שפירא", email: "ronit@example.com", taxId: "058173642" },
      existingCustomerId: "c5",
      agreement: terms,
    });
    expect(result).toMatchObject({ created: false, customerId: "c5", filled: ["taxId", "email"] });
    const c5 = db.customers.find((c) => c.id === "c5")!;
    expect(c5).toMatchObject({ name: "רונית שפירא", phone: "+972524567890", email: "ronit@example.com" });
  });

  it("saves nothing when the imported agreement is invalid", async () => {
    const before = db.customers.length;
    await expect(api.importAgreement({ customer: owner, agreement: { ...terms, startDate: "" } })).rejects.toThrow();
    await expect(api.importAgreement({ customer: { ...owner, phone: "" }, agreement: terms })).rejects.toThrow();
    expect(db.customers).toHaveLength(before);
  });

  it("saves imported details the way the system stores them", async () => {
    const result = await api.importAgreement({
      customer: { ...owner, name: "  משה   לוי ", phone: "054-123-4567", taxId: "20765-4328", email: " Moshe@Example.com " },
      agreement: terms,
    });
    expect((await api.getCustomer(result.customerId)).customer).toMatchObject({ name: "משה לוי", phone: "+972541234567", taxId: "207654328", email: "moshe@example.com" });
  });

  it("refuses an import with invalid details, saying which", async () => {
    await expect(api.importAgreement({ customer: { ...owner, email: "moshe@" }, agreement: terms })).rejects.toMatchObject({
      checks: expect.arrayContaining([expect.objectContaining({ code: "email_invalid", level: "error" })]),
    });
    await expect(api.importAgreement({ customer: { ...owner, phone: "054-12" }, agreement: terms })).rejects.toThrow(/phone_invalid/);
  });

  it("refuses the same agreement twice", async () => {
    await api.importAgreement({ customer: owner, agreement: terms });
    const id = db.customers.at(-1)!.id;
    await expect(api.importAgreement({ customer: owner, existingCustomerId: id, agreement: terms })).rejects.toThrow(/duplicate_agreement/);
  });

  it("warns about a property under another agreement, owned by someone else, or not found", async () => {
    // p1 is c1's, under agreement #3001 with no end date.
    const checks = await api.checkAgreementImport({ customer: owner, agreement: { ...terms, propertyIds: ["p1"] }, unmatchedAddresses: ["רחוב שלא קיים 1"] });
    expect(checks.map((c) => [c.code, c.level, c.detail])).toEqual([
      ["property_in_other_agreement", "warning", "הרצל 12 / 5, רמת גן (#3001)"],
      ["property_other_owner", "warning", "הרצל 12 / 5, רמת גן: יוסי כהן"],
      ["property_unmatched", "warning", "רחוב שלא קיים 1"],
    ]);
    // The owner's own renewal, after the old agreement ends, raises neither.
    const renewal = await api.checkNewAgreement({ customerId: "c3", ...terms, propertyIds: ["p3"], startDate: "2027-06-01" });
    expect(renewal).toEqual([]);
  });

  it("warns that a new customer looks like an existing one", async () => {
    const checks = await api.checkAgreementImport({ customer: { ...owner, phone: "+972521234567" }, agreement: terms });
    expect(checks.map((c) => c.code)).toContain("duplicate_customer");
  });

  it("describes an agreement's record for checking its document", async () => {
    expect(await api.getAgreementRecord("ag2")).toMatchObject({ name: "גלבוע השקעות בע״מ", feeMinor: 450000, feePercent: undefined, properties: ["דרך מנחם בגין 132 / 1804, תל אביב", "קריית המלאכה, ראש העין"] });
  });

  it("matches by block and parcel first, and by address between units on the same lot", async () => {
    db.properties.find((p) => p.id === "p12")!.block = "5000";
    db.properties.find((p) => p.id === "p12")!.parcel = "9";
    db.properties.find((p) => p.id === "p13")!.block = "5000";
    db.properties.find((p) => p.id === "p13")!.parcel = "9";
    const found = await api.matchProperties(["כתובת אחרת לגמרי (גוש 6123, חלקה 45)", "המלאכה 8 / 301, ראש העין (גוש 5000, חלקה 9)"]);
    expect(found.map((f) => f.property?.id)).toEqual(["p1", "p13"]);
  });

  it("matches property addresses from a document to properties in the system", async () => {
    const found = await api.matchProperties(["הרצל 12/5, רמת גן", "המלאכה 8 / 201 ראש העין", "רחוב שלא קיים 1, אילת"]);
    expect(found.map((f) => f.property?.id)).toEqual(["p1", "p12", undefined]);
  });
});

describe("search", () => {
  it("finds professionals by name and customers by phone", async () => {
    expect((await api.search("מעליות")).map((r) => [r.kind, r.id])).toContainEqual(["professional", "pr4"]);
    expect((await api.search("052-123-4567")).map((r) => r.id)).toContain("c1");
  });
});
