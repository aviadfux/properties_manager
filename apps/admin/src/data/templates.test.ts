import { describe, expect, it } from "vitest";
import type { FormContext } from "@/domain/types";
import { en } from "@/i18n/en";
import { he } from "@/i18n/he";
import * as db from "./sample";
import { FIELDS, render, toBlocks } from "./templates";

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
