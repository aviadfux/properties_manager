// Personal data must not leave the system by accident: these rules decide what an AI model, a log
// or a support ticket could ever see (docs/SECURITY.md).
import { describe, expect, it } from "vitest";
import { isValidIsraeliId, labelKind, mask, redact, restore } from "./sensitive";

describe("Israeli ID check digit", () => {
  it.each(["034827139", "515123453", "324567817", "34827139"])("accepts %s", (id) => expect(isValidIsraeliId(id)).toBe(true));
  it.each(["034827138", "515123456", "000000000", "12a", ""])("rejects %s", (id) => expect(isValidIsraeliId(id)).toBe(false));
});

describe("masking", () => {
  it("keeps only the last four characters", () => {
    expect(mask("515123453")).toBe("•••••3453");
    expect(mask("123")).toBe("•••");
  });
});

describe("labels", () => {
  it.each([
    ["ת.ז. / ח.פ.", "taxId"],
    ["ID / company no.", "taxId"],
    ["דוא״ל", "email"],
    ["Email", "email"],
    ["טלפון נייד", "phone"],
    ["Phone", "phone"],
    ["כתובת", "address"],
    ["Billing address", "address"],
    ["שם", "name"],
    ["Full name", "name"],
    ["פרטי חשבון בנק", "bank"],
  ])("reads %s as %s", (label, kind) => expect(labelKind(label)).toBe(kind));

  it.each(["תקופת ההסכם", "Management fee", "Agreement no.", "Hotel", "בשם הבעלים"])("does not treat %s as personal", (label) =>
    expect(labelKind(label)).toBeUndefined(),
  );
});

describe("redaction", () => {
  const agreement = `# הסכם ניהול
## הבעלים
שם: משה לוי
ת.ז.: 034827139
טלפון: 054-123-4567 · דוא״ל: moshe@example.com
כתובת: הגפן 3, חיפה
חשבון בנק: בנק 12, סניף 345, חשבון 678901
## תנאים
דמי ניהול: 6% משכר הדירה
משה לוי ישלם עד ה־10 בכל חודש. לבירורים: +972-3-612-3456, IBAN IL62 0108 0000 0009 9999 999.
כרטיס: 4111 1111 1111 1111`;
  const SECRETS = ["משה לוי", "034827139", "054-123-4567", "moshe@example.com", "הגפן 3", "678901", "612-3456", "IL62", "4111 1111"];

  it("removes every personal detail", () => {
    const { text } = redact(agreement, [{ kind: "NAME", value: "משה לוי" }]);
    for (const secret of SECRETS) expect(text, secret).not.toContain(secret);
  });

  it("restores values that contain an earlier token", () => {
    const original = "Name: Dana Katz\nDana called.";
    const { text, redactions } = redact(original, [{ kind: "NAME", value: "Dana" }]);
    expect(text).not.toContain("Dana");
    expect(restore(text, redactions)).toBe(original);
  });

  it("hides a labeled name where the text repeats it without a label", () => {
    expect(redact("Name: Dana Katz\nDana Katz will pay on the 10th.").text).toBe("Name: [NAME_1]\n[NAME_1] will pay on the 10th.");
  });

  it("keeps everything that is not personal, so the text still makes sense", () => {
    const { text } = redact(agreement, [{ kind: "NAME", value: "משה לוי" }]);
    expect(text).toContain("דמי ניהול: 6% משכר הדירה");
    expect(text).toContain("ישלם עד ה־10 בכל חודש");
    expect(text).toMatch(/^שם: \[NAME_1\]$/m);
  });

  it("gives the same value the same token, and restores the original", () => {
    const { text, redactions } = redact(agreement, [{ kind: "NAME", value: "משה לוי" }]);
    expect(text.match(/\[NAME_1\]/g)).toHaveLength(2);
    expect(restore(text, redactions)).toBe(agreement);
    // An answer that uses the tokens comes back with the real values, locally.
    expect(restore("Owner: [NAME_1], [PHONE_1]", redactions)).toBe("Owner: משה לוי, 054-123-4567");
  });

  it("reads a number after an ID word as an ID, even if it looks like a phone number", () => {
    expect(redact("לבין משה, ת.ז. 034827139, טלפון 03-612-3456").text).toBe("לבין משה, ת.ז. [ID_1], טלפון [PHONE_1]");
  });

  it("does not touch dates, amounts, percentages or empty fields", () => {
    const text = "תקופת ההסכם: 01/03/2026 – 28/02/2027\nדמי ניהול: ₪1,200 לחודש\nסף: 7%\nשם: ______";
    expect(redact(text).text).toBe(text);
  });

  it("only replaces card numbers that pass the card check", () => {
    expect(redact("Ref 1234 5678 9012 3456").text).toBe("Ref 1234 5678 9012 3456");
  });
});
