// Randomized round trips: hundreds of invented customers and agreements — Hebrew and English names,
// companies, apostrophes and hyphens, foreign phones, missing details, agorot, open-ended terms —
// are exported with the agreement template and imported back. Every detail must survive, in both
// languages and through Word, and redaction must hide every personal detail of every one of them.
// The generator is seeded, so a failure always reproduces (the seed and case number are in the message).
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Customer, ManagementAgreement } from "@/domain/types";
import { redact } from "@/security/sensitive";
import { extractAgreement } from "./agreements";
import { compareWithRecord } from "./checks";
import { readDocxText, writeDocx } from "./docx";
import { render, toBlocks } from "./templates";

const SEED = 20261106;
const CASES = 150;

/** Small seeded random generator (mulberry32). */
function random(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(items: readonly T[]) => items[int(0, items.length - 1)];
  const chance = (p: number) => next() < p;
  return { int, pick, chance };
}

const FIRST_HE = ["משה", "דנה", "אבי", "רחל", "יוסי", "מיכל", "ז'ורז'", "שי-לי", "אורי", "נועה"];
const LAST_HE = ["לוי", "כהן", "בן-דוד", "אברהם", "שפירא", "פרץ", "אוחיון", "ביטון", "גולדברג", "דהן"];
const FIRST_EN = ["David", "Sarah", "Liam", "Noa", "Michael", "Anne-Marie", "Dana", "Jean"];
const LAST_EN = ["Miller", "O'Brien", "Cohen", "Smith-Jones", "Katz", "Levi", "D'Angelo"];
const COMPANY_HE = ["גלבוע השקעות בע״מ", 'נכסי השרון בע"מ', "א.ב. אחזקות בע״מ", "קבוצת המרכז (2020) בע״מ"];
const COMPANY_EN = ["Gilboa Investments Ltd", "Sharon Holdings Ltd.", "A.B. Properties Limited", "North & South Assets Ltd"];
const STREETS = ["הרצל", "ביאליק", "רוטשילד", "Herzl", "Weizmann", "Ben Yehuda", "דרך מנחם בגין"];
const CITIES = ["תל אביב", "חיפה", "רמת גן", "Tel Aviv", "Haifa", "Be'er Sheva"];

function validId(r: ReturnType<typeof random>, prefix = "") {
  for (;;) {
    const body = prefix + Array.from({ length: 8 - prefix.length }, () => r.int(0, 9)).join("");
    for (let d = 0; d <= 9; d++) {
      const id = body + d;
      let sum = 0;
      [...id].forEach((ch, i) => {
        const n = Number(ch) * ((i % 2) + 1);
        sum += n > 9 ? n - 9 : n;
      });
      if (sum % 10 === 0) return id;
    }
  }
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function generate(r: ReturnType<typeof random>, n: number, propertyIds: string[]) {
  const company = r.chance(0.3);
  const english = r.chance(0.4);
  const name = company ? r.pick(english ? COMPANY_EN : COMPANY_HE) : english ? `${r.pick(FIRST_EN)} ${r.pick(LAST_EN)}` : `${r.pick(FIRST_HE)} ${r.pick(LAST_HE)}`;
  const phone = r.pick([
    () => `+9725${r.int(0, 8)}${r.int(1000000, 9999999)}`,
    () => `+972${r.pick([2, 3, 4, 8, 9])}${r.int(1000000, 9999999)}`,
    () => `+97277${r.int(1000000, 9999999)}`,
    () => `+4420${r.int(10000000, 99999999)}`,
    () => `+1212${r.int(1000000, 9999999)}`,
  ])();
  const customer: Customer = {
    id: `cx${n}`,
    number: 9000 + n,
    kind: company ? "company" : "individual",
    name,
    taxId: r.chance(0.7) ? validId(r, company ? "51" : "") : undefined,
    phone,
    email: r.chance(0.7) ? `${r.pick(["dana", "m.levi", "office+rent", "a_b"])}${n}@${r.pick(["", "mail."])}example.com` : undefined,
    billingAddress: r.chance(0.6) ? `${r.pick(STREETS)} ${r.int(1, 200)}${r.chance(0.3) ? ` / ${r.int(1, 40)}` : ""}, ${r.pick(CITIES)}` : undefined,
    preferredLanguage: english ? "en" : "he",
    preferredChannel: "email",
    status: "active",
  };
  const year = r.int(2015, 2030);
  const start = iso(year, r.int(1, 12), r.int(1, 28));
  const feeModel = r.pick(["fixed", "percent_of_rent", "percent_with_minimum"] as const);
  const agreement: ManagementAgreement = {
    id: `agx${n}`,
    number: 9000 + n,
    customerId: customer.id,
    propertyIds: [...new Set(Array.from({ length: r.int(1, 3) }, () => r.pick(propertyIds)))],
    startDate: start,
    endDate: r.chance(0.5) ? iso(year + r.int(1, 5), r.int(1, 12), r.int(1, 28)) : undefined,
    feeModel,
    feePercent: feeModel === "fixed" ? undefined : r.pick([r.int(1, 20), r.int(1, 20) + 0.5, 7.25]),
    feeMinor: feeModel === "percent_of_rent" ? undefined : r.int(10000, 2000099), // ₪100.00 – ₪20,000.99, often with agorot
    plusVat: r.chance(0.5),
    billingFrequency: r.pick(["monthly", "quarterly"] as const),
    approvalThresholdMinor: r.chance(0.5) ? r.pick([r.int(1, 50) * 10000, r.int(100, 999999)]) : undefined,
    language: english ? "en" : "he",
    source: "generated",
    createdAt: "2026-01-01T00:00:00Z",
  };
  return { customer, agreement };
}

let api: typeof import("./api");
let db: typeof import("./sample");
const cases: { n: number; language: "he" | "en"; text: string; customer: Customer }[] = [];
const failures: string[] = [];

beforeAll(async () => {
  vi.resetModules();
  db = await import("./sample");
  api = await import("./api");
  const r = random(SEED);
  const own = { name: db.organization.name, phone: db.organization.phone, email: db.organization.email };
  const template = db.formTemplates.find((t) => t.id === "ft2")!;
  for (let n = 0; n < CASES; n++) {
    const { customer, agreement } = generate(r, n, db.properties.map((p) => p.id));
    db.customers.push(customer);
    db.agreements.push(agreement);
    for (const language of ["he", "en"] as const) {
      const record = await api.getAgreementRecord(agreement.id, language);
      const text = render(template.body[language]!, "agreement", await api.getFormValues("agreement", agreement.id, language)).text;
      cases.push({ n, language, text, customer });
      const viaText = compareWithRecord(record, extractAgreement(text, own));
      if (viaText.length) failures.push(`seed ${SEED} case ${n} (${language}, text): ${viaText.join(", ")}\n${text}`);
      if (n % 5 === 0) {
        const word = await readDocxText(writeDocx(toBlocks(text), { rtl: language === "he" }));
        const viaWord = compareWithRecord(record, extractAgreement(word, own));
        if (viaWord.length) failures.push(`seed ${SEED} case ${n} (${language}, Word): ${viaWord.join(", ")}`);
      }
    }
  }
});

describe(`${CASES} random agreements`, () => {
  it("export and import back with every detail intact, in Hebrew and English, as text and through Word", () => {
    expect(cases).toHaveLength(CASES * 2);
    expect(failures.slice(0, 3)).toEqual([]);
  });

  it("never let a personal detail through redaction", () => {
    const leaks: string[] = [];
    const formatted = (phone: string) => (phone.startsWith("+972") ? `0${phone.slice(4)}` : phone);
    for (const { n, language, text, customer: c } of cases) {
      const { text: safe } = redact(text, [{ kind: "NAME", value: c.name }]);
      const secrets = [c.name, c.taxId, c.email, c.billingAddress, formatted(c.phone).replace(/\D/g, "").slice(-7)].filter(Boolean) as string[];
      for (const secret of secrets) if (safe.replace(/[-\s]/g, "").includes(secret.replace(/[-\s]/g, ""))) leaks.push(`case ${n} (${language}): ${secret}`);
    }
    expect(leaks.slice(0, 5)).toEqual([]);
  });
});
