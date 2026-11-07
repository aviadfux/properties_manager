import { describe, expect, it } from "vitest";
import type { FormContext } from "@/domain/types";
import { en } from "@/i18n/en";
import { he } from "@/i18n/he";
import * as db from "./sample";
import { AGREEMENT_REQUIRED, FIELDS, missingRequired, render, toBlocks } from "./templates";

describe("render", () => {
  it("fills known fields, tolerating spaces inside the braces", () => {
    const out = render("Hello {{tenant.name}}, rent {{ lease.rent }}", "lease", { "tenant.name": "Noa", "lease.rent": "₪6,500" });
    expect(out).toEqual({ text: "Hello Noa, rent ₪6,500", missing: [], unknown: [] });
  });

  it("shows a dash for a known field without a value and reports it once", () => {
    const out = render("{{tenant.email}} / {{tenant.email}}", "lease", { "tenant.email": "" });
    expect(out.text).toBe("— / —");
    expect(out.missing).toEqual(["tenant.email"]);
  });

  it("leaves a field the record type does not offer as written and reports it", () => {
    const out = render("{{issue.title}}", "lease", { "issue.title": "Leak" });
    expect(out.text).toBe("{{issue.title}}");
    expect(out.unknown).toEqual(["issue.title"]);
  });
});

describe("toBlocks", () => {
  it("turns line markers into blocks and skips empty lines", () => {
    expect(toBlocks("# Title\n\n## Section\n- item\n[ ] check\n[] check2\n---\nplain ____")).toEqual([
      { type: "title", text: "Title" },
      { type: "section", text: "Section" },
      { type: "bullet", text: "item" },
      { type: "checkbox", text: "check" },
      { type: "checkbox", text: "check2" },
      { type: "divider" },
      { type: "paragraph", text: "plain ____" },
    ]);
  });
});

describe("fields", () => {
  it("offers company fields and today's date on every record type", () => {
    for (const fields of Object.values(FIELDS)) expect(fields).toEqual(expect.arrayContaining(["company.name", "today"]));
  });

  it("has a label for every field in both languages", () => {
    for (const key of new Set(Object.values(FIELDS).flat())) {
      expect(he.forms.fieldLabels[key], key).toBeTruthy();
      expect(en.forms.fieldLabels[key], key).toBeTruthy();
    }
  });

  it("is used correctly by every sample template (no typos in placeholders)", () => {
    for (const t of db.formTemplates) {
      for (const [language, body] of Object.entries(t.body)) {
        expect(render(body!, t.context as FormContext, {}).unknown, `${t.name} (${language})`).toEqual([]);
      }
    }
  });
});

describe("values inside documents", () => {
  it("keeps one-line fields on one line, so a pasted line break cannot add a heading or bullet", () => {
    const { text } = render("Name: {{customer.name}}", "customer", { "customer.name": "Dana\n## Katz\r\n- x" });
    expect(text).toBe("Name: Dana ## Katz - x");
    expect(toBlocks(text)).toHaveLength(1);
  });

  it("keeps the lines of list fields", () => {
    expect(render("{{agreement.properties}}", "agreement", { "agreement.properties": "- A\n- B" }).text).toBe("- A\n- B");
  });

  it("never expands placeholders that come from data", () => {
    expect(render("{{customer.name}}", "customer", { "customer.name": "{{company.bankDetails}}", "company.bankDetails": "secret" }).text).toBe("{{company.bankDetails}}");
  });
});

describe("agreement templates", () => {
  it("the sample agreement template states every detail, in both languages", () => {
    const ft2 = db.formTemplates.find((t) => t.id === "ft2")!;
    expect(missingRequired(ft2.body.he!, AGREEMENT_REQUIRED)).toEqual([]);
    expect(missingRequired(ft2.body.en!, AGREEMENT_REQUIRED)).toEqual([]);
  });

  it("reports the fields a template leaves out", () => {
    expect(missingRequired("Name: {{ customer.name }}", ["customer.name", "customer.taxId"])).toEqual(["customer.taxId"]);
  });
});
