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

describe("search", () => {
  it("finds professionals by name and customers by phone", async () => {
    expect((await api.search("מעליות")).map((r) => [r.kind, r.id])).toContainEqual(["professional", "pr4"]);
    expect((await api.search("052-123-4567")).map((r) => r.id)).toContain("c1");
  });
});
