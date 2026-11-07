// Personal and sensitive data: recognizing it, showing it masked, and removing it from text before
// the text leaves the system (to an AI model, a log, an error report or a support ticket).
// Rules: docs/SECURITY.md. Pure functions without imports, so that the backend can port them
// (apps/api/core) and scripts/redact.mjs can run this file directly in Node.

/** Israeli ID / company number check digit (the same rule for ת.ז. and ח.פ.). */
export function isValidIsraeliId(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{5,9}$/.test(digits) || /^0+$/.test(digits)) return false;
  let sum = 0;
  [...digits.padStart(9, "0")].forEach((d, i) => {
    const n = Number(d) * ((i % 2) + 1);
    sum += n > 9 ? n - 9 : n;
  });
  return sum % 10 === 0;
}

/** Hides all but the last characters: "515123453" → "•••••3453". */
export function mask(value: string, visible = 4): string {
  return value.length <= visible ? "•".repeat(value.length) : "•".repeat(value.length - visible) + value.slice(-visible);
}

// ---------- field labels ----------
// "Name:", "ת.ז.:", "Phone:"… in documents and messages. Shared by redaction and by the agreement
// import (src/data/agreements.ts), so both recognize the same labels.

export type LabelKind = "name" | "taxId" | "phone" | "email" | "address" | "bank";

const LABEL_KINDS: [LabelKind, RegExp][] = [
  ["taxId", /(^|\s)(תז|חפ|עמ|עוסק מורשה|מספר זהות|מספר חברה|זהות|דרכון|id|id number|id no|company no|company number|tax id|passport)(\s|\/|$)/],
  ["email", /(דואל|אימייל|מייל|e-?mail)/],
  ["phone", /(^|\s)(טלפון|נייד|טל|פלאפון|phone|mobile|tel|cell)(\s|\/|$)/],
  ["bank", /(בנק|חשבון|סניף|כרטיס|אשראי|iban|bank|account|card)/],
  ["address", /(כתובת|מען|address)/],
  ["name", /(^|\s)(ה?שם|name)(\s|$)/],
];

/** Removes quotes, dots and direction marks: "ת.ז. / ח.פ." → "תז / חפ", "דוא״ל" → "דואל". */
export const normalizeLabel = (label: string) =>
  label
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .replace(/["'״׳.]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function labelKind(label: string): LabelKind | undefined {
  const l = normalizeLabel(label);
  return LABEL_KINDS.find(([, re]) => re.test(l))?.[0];
}

/** "Label: value" (a line may hold several, separated by "·" or "|"). */
export const LABELED = /^(\s*)([^:：]{1,40}?)(\s*[:：]\s*)(.*)$/;
export const SEGMENT_SEPARATOR = /(\s[·|]\s)/;

// ---------- patterns ----------

export const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Israeli mobile and landline numbers, local or international (052-123-4567, +972 3 612 3456).
export const PHONE_IL = /(?<![\d+])(?:\+972[\s-]?|0)(?:5\d|7\d|[2-489])(?:[\s-]?\d){7}(?!\d)/g;
const PHONE_INTL = /(?<![\d\w])\+\d{1,3}(?:[\s-]?\d){7,12}(?!\d)/g;
// 8–9 digits on their own (an ID or company number), or 7–8 digits, dash, check digit.
export const ID_NUMBER = /(?<![\d-])(?:\d{8,9}|\d{7,8}-\d)(?![\d-])/g;
// A number right after "ת.ז." / "ח.פ." / "ID" is an ID even when it looks like a phone number (034827139).
const ID_AFTER_WORD = /((?:ת\.?\s?ז|ח\.?\s?פ|מספר זהות|\bID\b|company no)\.?\s*:?\s*)(\d[\d-]{6,9}\d)(?!\d)/gi;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z\d]{4}){3,7}(?:\s?[A-Z\d]{1,3})?\b/g;
const CARD = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
// "חשבון 678901", "account no. 12-345": the number after a bank word, even without a colon.
const ACCOUNT = /(חשבון|ח-ן|סניף|account(?:\s+no\.?)?|branch)(\s*(?:מס['׳]?\s*)?)(\d[\d-]{2,})/gi;

const luhn = (digits: string) =>
  [...digits].reverse().reduce((sum, d, i) => {
    const n = Number(d) * (i % 2 ? 2 : 1);
    return sum + (n > 9 ? n - 9 : n);
  }, 0) %
    10 ===
  0;

// ---------- redaction ----------

export type RedactionKind = "NAME" | "ID" | "PHONE" | "EMAIL" | "ADDRESS" | "BANK" | "CARD";
export type Redaction = { token: string; kind: RedactionKind; value: string };
export type Redacted = { text: string; redactions: Redaction[] };

const KIND_OF_LABEL: Record<LabelKind, RedactionKind> = { name: "NAME", taxId: "ID", phone: "PHONE", email: "EMAIL", address: "ADDRESS", bank: "BANK" };
const TOKEN = /\[(?:NAME|ID|PHONE|EMAIL|ADDRESS|BANK|CARD)_\d+\]/g;
const onlyTokens = (s: string) => !s.replace(TOKEN, "").replace(/[\s,;·|–-]/g, "");

/**
 * Replaces personal details with tokens such as [PHONE_1]. The same value always gets the same
 * token, so the text keeps its meaning ("[NAME_1] owns …, [NAME_1] will pay …") and an answer that
 * uses the tokens can be turned back with `restore`. The redactions (the token → value map) never
 * leave the system; only `text` may be sent out.
 *
 * Catches: values after a label (Name:, ת.ז.:, Address:, Account:…), e-mail addresses, phone
 * numbers, ID and company numbers, IBANs, card numbers, account numbers after a bank word, and any
 * `known` values (e.g. the customer's name, which free text can mention without a label).
 * Best effort: free text can still hold details no rule recognizes, so a person checks before
 * anything is shared outside the system.
 */
export function redact(text: string, known: { kind: RedactionKind; value: string }[] = []): Redacted {
  const redactions: Redaction[] = [];
  const tokenFor = (kind: RedactionKind, raw: string) => {
    const value = raw.trim();
    let r = redactions.find((x) => x.kind === kind && x.value === value);
    if (!r) {
      r = { kind, value, token: `[${kind}_${redactions.filter((x) => x.kind === kind).length + 1}]` };
      redactions.push(r);
    }
    return r.token;
  };

  let out = text.replace(/\r\n?/g, "\n");

  // 1. Values the caller already knows are personal, longest first ("David Miller" before "David").
  const knownValues = known.map((k) => ({ ...k, value: k.value.trim() })).filter((k) => k.value.length >= 2);
  for (const k of knownValues.sort((a, b) => b.value.length - a.value.length)) out = out.split(k.value).join(tokenFor(k.kind, k.value));

  // 2. Whatever follows a personal label.
  out = out
    .split("\n")
    .map((line) =>
      line
        .split(SEGMENT_SEPARATOR)
        .map((segment) => {
          const m = LABELED.exec(segment);
          const kind = m && labelKind(m[2]);
          const value = m?.[4].trim();
          if (!m || !kind || !value || onlyTokens(value) || /^[—_\-–.]+$/.test(value)) return segment;
          return `${m[1]}${m[2]}${m[3]}${tokenFor(KIND_OF_LABEL[kind], value)}`;
        })
        .join(""),
    )
    .join("\n");

  // A value found after a label is also hidden where the text repeats it without one
  // ("Name: Moshe Levi … Moshe Levi will pay").
  for (const r of [...redactions].sort((x, y) => y.value.length - x.value.length)) if (r.value.length >= 3) out = out.split(r.value).join(r.token);

  // 3. Recognizable patterns anywhere in the text.
  out = out
    .replace(EMAIL, (v) => tokenFor("EMAIL", v))
    .replace(IBAN, (v) => tokenFor("BANK", v))
    .replace(CARD, (v) => (luhn(v.replace(/\D/g, "")) && v.replace(/\D/g, "").length >= 13 ? tokenFor("CARD", v) : v))
    .replace(ID_AFTER_WORD, (_, word: string, number: string) => `${word}${tokenFor("ID", number)}`)
    .replace(PHONE_IL, (v) => tokenFor("PHONE", v))
    .replace(PHONE_INTL, (v) => tokenFor("PHONE", v))
    .replace(ID_NUMBER, (v) => tokenFor("ID", v))
    .replace(ACCOUNT, (_, word: string, gap: string, number: string) => `${word}${gap}${tokenFor("BANK", number)}`);

  return { text: out, redactions };
}

/** Puts the original values back into text that uses the tokens (e.g. an AI model's answer). */
export function restore(text: string, redactions: Redaction[]): string {
  // Latest first: a later value can contain an earlier token ("[NAME_1] Katz").
  return redactions.reduceRight((out, r) => out.split(r.token).join(r.value), text);
}
