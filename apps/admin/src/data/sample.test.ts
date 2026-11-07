// The sample data must obey the same rules the database will enforce (docs/DATA_MODEL.md),
// so that screens built on it do not hide bugs that real data would show.
import { describe, expect, it } from "vitest";
import { PROPERTY_KINDS } from "@/domain/types";
import { isValidIsraeliId } from "@/security/sensitive";
import { TODAY } from "@/test/utils";
import * as db from "./sample";

const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((r) => r.id));

describe("sample data", () => {
  it("has unique ids and numbers per entity", () => {
    for (const rows of [db.customers, db.properties, db.tenants, db.issues, db.professionals, db.leases, db.ownerships, db.paymentRequests, db.agreements]) {
      expect(ids(rows as { id: string }[]).size).toBe(rows.length);
    }
    for (const rows of [db.customers, db.properties, db.tenants, db.issues, db.professionals, db.paymentRequests, db.agreements]) {
      expect(new Set(rows.map((r) => r.number)).size).toBe(rows.length);
    }
  });

  it("only references records that exist", () => {
    const [customers, properties, tenants, users, pros, areas, templates] = [
      ids(db.customers),
      ids(db.properties),
      ids(db.tenants),
      ids(db.users),
      ids(db.professionals),
      ids(db.serviceAreas),
      ids(db.formTemplates),
    ];
    for (const o of db.ownerships) expect(customers.has(o.customerId) && properties.has(o.propertyId)).toBe(true);
    for (const l of db.leases) expect(properties.has(l.propertyId) && tenants.has(l.tenantId)).toBe(true);
    for (const p of db.properties) if (p.parentId) expect(properties.has(p.parentId)).toBe(true);
    for (const i of db.issues) {
      expect(properties.has(i.propertyId)).toBe(true);
      expect(customers.has(i.customerId)).toBe(true);
      if (i.assigneeId) expect(users.has(i.assigneeId)).toBe(true);
      if (i.professionalId) expect(pros.has(i.professionalId)).toBe(true);
      const reporters = { customer: customers, tenant: tenants, user: users }[i.reporter.type];
      expect(reporters.has(i.reporter.id)).toBe(true);
    }
    for (const p of db.professionals) for (const a of p.serviceAreaIds) expect(areas.has(a)).toBe(true);
    for (const r of db.reminderRules) expect(templates.has(r.templateId)).toBe(true);
    for (const r of db.paymentRequests) {
      expect(customers.has(r.customerId)).toBe(true);
      if (r.propertyId) expect(properties.has(r.propertyId)).toBe(true);
    }
  });

  it("has no cycles in the property hierarchy", () => {
    for (const p of db.properties) {
      const seen = new Set([p.id]);
      for (let cur = p; cur.parentId; ) {
        expect(seen.has(cur.parentId), `cycle through ${cur.parentId}`).toBe(false);
        seen.add(cur.parentId);
        cur = db.properties.find((x) => x.id === cur.parentId)!;
      }
    }
  });

  it("uses only known property kinds", () => {
    for (const p of db.properties) expect(PROPERTY_KINDS).toContain(p.kind);
  });

  it("has current ownership shares that sum to 100 per property", () => {
    const current = db.ownerships.filter((o) => o.startDate <= TODAY && (!o.endDate || o.endDate >= TODAY));
    const totals = new Map<string, number>();
    for (const o of current) totals.set(o.propertyId, (totals.get(o.propertyId) ?? 0) + o.sharePercent);
    for (const [property, total] of totals) expect(total, property).toBe(100);
  });

  it("has leases that end after they start, with rent in whole agorot", () => {
    for (const l of db.leases) {
      expect(l.endDate > l.startDate).toBe(true);
      expect(Number.isInteger(l.monthlyRentMinor)).toBe(true);
    }
  });

  it("keeps closing details only on closed or cancelled issues", () => {
    for (const i of db.issues) {
      const done = i.status === "closed" || i.status === "cancelled";
      expect(Boolean(i.closedAt), `#${i.number}`).toBe(done);
      if (i.status === "closed") expect(i.resolution && i.actualCostMinor !== undefined, `#${i.number}`).toBeTruthy();
    }
  });

  // The repository is public: sample data must be invented (docs/SECURITY.md §5).
  it("uses only reserved example addresses for email", () => {
    const emails = [db.organization.email, ...[...db.customers, ...db.tenants, ...db.professionals, ...db.users].flatMap((p) => p.email ?? [])];
    for (const email of emails) expect(email).toMatch(/@(?:[\w-]+\.)*example\.com$/);
  });

  it("has valid ID and company numbers (check digit)", () => {
    for (const p of [...db.customers, ...db.tenants]) if (p.taxId) expect(isValidIsraeliId(p.taxId), p.name).toBe(true);
  });

  it("has agreements with existing customers and properties, and one fee each", () => {
    const [customers, properties] = [ids(db.customers), ids(db.properties)];
    for (const a of db.agreements) {
      expect(customers.has(a.customerId), a.id).toBe(true);
      for (const p of a.propertyIds) expect(properties.has(p), a.id).toBe(true);
      expect(a.feePercent !== undefined, a.id).toBe(a.feeModel !== "fixed");
      expect(a.feeMinor !== undefined, a.id).toBe(a.feeModel !== "percent_of_rent");
      if (a.endDate) expect(a.endDate > a.startDate, a.id).toBe(true);
    }
  });

  it("does not let paid amounts exceed the request", () => {
    for (const r of db.paymentRequests) expect(r.paidMinor).toBeLessThanOrEqual(r.amountMinor);
  });
});
