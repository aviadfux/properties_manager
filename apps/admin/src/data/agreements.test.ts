// Reading agreements: the details found in a document are what a new customer is created from, so
// a wrong reading means a wrong customer record.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanEmail, cleanName, extractAgreement, findDates, normalizePhone, parseDate, parseFee, parseMoney, parseRegistry } from "./agreements";
import { readDocxText, writeDocx } from "./docx";
import { render, toBlocks } from "./templates";

let api: typeof import("./api");
let db: typeof import("./sample");
beforeEach(async () => {
  vi.resetModules();
  db = await import("./sample");
  api = await import("./api");
});

const own = () => ({ name: db.organization.name, phone: db.organization.phone, email: db.organization.email });

/** The agreement document the system exports for a sample agreement. */
async function exported(agreementId: string, language: "he" | "en") {
  const template = db.formTemplates.find((t) => t.id === "ft2")!;
  return render(template.body[language]!, "agreement", await api.getFormValues("agreement", agreementId, language)).text;
}

describe("value parsing", () => {
  it.each([
    ["052-123-4567", "+972521234567"],
    ["0521234567", "+972521234567"],
    ["03-612-3456", "+97236123456"],
    ["+972 52 123 4567", "+972521234567"],
    ["+972-(0)52-123-4567", "+972521234567"],
    ["00972521234567", "+972521234567"],
    ["077-1234567", "+972771234567"],
    ["+44 20 7946 0958", "+442079460958"], // an owner living abroad
    ["001 212 555 0100", "+12125550100"],
    ["052-123-456", undefined], // a digit short
    ["03-612-34567", undefined], // a landline with a mobile's length
    ["12345", undefined],
    ["5551234567", undefined], // no 0 and no country code: cannot tell
    ["", undefined],
  ])("phone %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each([
    ["31/12/2026", "2026-12-31"],
    ["1.3.26", "2026-03-01"],
    ["01-03-2026", "2026-03-01"],
    ["2026-12-31", "2026-12-31"],
    ["29/02/2028", "2028-02-29"], // leap year
    ["1 בינואר 2026", "2026-01-01"],
    ["15 במרץ 2026", "2026-03-15"],
    ["1 בינו׳ 2026", "2026-01-01"], // as the app prints dates in Hebrew
    ["1 January 2026", "2026-01-01"],
    ["1st of March 2026", "2026-03-01"],
    ["March 1, 2026", "2026-03-01"],
    ["Sept. 30, 2026", "2026-09-30"],
    ["32/01/2026", undefined],
    ["31/04/2026", undefined], // April has 30 days
    ["29/02/2026", undefined], // not a leap year
    ["13/13/2026", undefined],
    ["1 Smarch 2026", undefined],
    ["01/01/1900", undefined], // out of range: a typo
  ])("date %s", (input, expected) => expect(parseDate(input)).toBe(expected));

  it("finds every date in a sentence, in order", () => {
    expect(findDates("מיום 1 בינואר 2026 ועד 31/12/2026 (ולא 31/02/2026)")).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it.each([
    ['מר משה לוי (להלן: "הבעלים")', "משה לוי"],
    ["Mrs. Dana Katz,", "Dana Katz"],
    ['ד"ר  רונית   שפירא', "רונית שפירא"],
    ['"Gilboa Investments Ltd"', "Gilboa Investments Ltd"],
    ["12345", undefined],
    ["—", undefined],
  ])("name %s", (input, expected) => expect(cleanName(input)).toBe(expected));

  it.each([
    ["Moshe@Example.COM.", "moshe@example.com"],
    ["mail: dana.k+home@mail.example.com;", "dana.k+home@mail.example.com"],
    ["not an email@", undefined],
    ["a@b", undefined],
  ])("email %s", (input, expected) => expect(cleanEmail(input)).toBe(expected));

  it.each([
    ["₪1,200", 120000],
    ["‏1,200 ‏₪ לחודש", 120000],
    ["ILS 450.5", 45050],
  ])("money %s", (input, expected) => expect(parseMoney(input)).toBe(expected));
});

describe("agreements exported by the system read back exactly", () => {
  it.each(["ag1", "ag2", "ag3", "ag4"])("%s in Hebrew and English", async (id) => {
    const a = db.agreements.find((x) => x.id === id)!;
    const c = db.customers.find((x) => x.id === a.customerId)!;
    for (const language of ["he", "en"] as const) {
      const x = extractAgreement(await exported(id, language), own());
      expect(x.language).toBe(language);
      expect(x.customer.name?.value).toBe(c.name);
      expect(x.customer.taxId?.value).toBe(c.taxId);
      expect(x.customer.phone?.value).toBe(c.phone);
      expect(x.customer.email?.value).toBe(c.email);
      expect(x.customer.billingAddress?.value).toBe(c.billingAddress);
      expect(x.customer.kind.value).toBe(c.kind);
      expect(x.terms.startDate?.value).toBe(a.startDate);
      expect(x.terms.endDate?.value).toBe(a.endDate);
      expect(x.terms.feeModel?.value).toBe(a.feeModel);
      expect(x.terms.feePercent?.value).toBe(a.feePercent);
      expect(x.terms.feeMinor?.value).toBe(a.feeMinor);
      expect(Boolean(x.terms.plusVat?.value)).toBe(Boolean(a.plusVat));
      expect(x.terms.billingFrequency?.value).toBe(a.billingFrequency ?? "monthly");
      expect(x.terms.approvalThresholdMinor?.value).toBe(a.approvalThresholdMinor);
      const places = await api.matchProperties(x.properties.map((p) => p.value));
      expect(places.map((p) => p.property?.id)).toEqual(a.propertyIds);
      expect(x.warnings).toEqual([]);
    }
  });

  it("including through a Word file", async () => {
    const text = await exported("ag2", "he");
    const docx = writeDocx(toBlocks(text), { rtl: true });
    const x = extractAgreement(await readDocxText(docx), own());
    expect(x.customer.name?.value).toBe("גלבוע השקעות בע״מ");
    expect(x.customer.taxId?.value).toBe("515123453");
    expect(x.properties.map((p) => p.value)).toEqual(["דרך מנחם בגין 132 / 1804, תל אביב", "קריית המלאכה, ראש העין"]);
  });

  it("never takes the company's own details for the owner's", async () => {
    const x = extractAgreement(await exported("ag1", "he"), own());
    expect(x.customer.name?.value).not.toBe(db.organization.name);
    expect(x.customer.phone?.value).not.toBe(db.organization.phone);
  });
});

describe("agreements written elsewhere", () => {
  const freeText = `הסכם ניהול נכסים
שנערך ונחתם בתל אביב בין עוגן ניהול נכסים, טלפון 03-555-0100, office@example.com (להלן: "החברה")
לבין משה לוי, ת.ז. 034827139, מרחוב הגפן 3, חיפה, טלפון 054-1234567, דוא"ל moshe@example.com (להלן: "הבעלים").
ההסכם בתוקף החל מיום 01/03/2026 ועד יום 28/02/2027.
הבעלים ישלם לחברה דמי ניהול בשיעור 6% משכר הדירה.`;

  // 034827139 after "ת.ז." also looks like a Tel Aviv landline (03-4827139): it must be read as the ID only.
  // The company's own phone and email come first in the text and must not be taken for the owner's.
  it("finds the owner's details in free text, marked as needing a check", () => {
    const x = extractAgreement(freeText, own());
    expect(x.customer).toMatchObject({
      name: { value: "משה לוי", how: "pattern" },
      taxId: { value: "034827139" },
      phone: { value: "+972541234567" },
      email: { value: "moshe@example.com" },
      billingAddress: { value: "הגפן 3, חיפה" },
      kind: { value: "individual" },
    });
    expect(x.terms).toMatchObject({ startDate: { value: "2026-03-01" }, endDate: { value: "2027-02-28" }, feePercent: { value: 6 } });
  });

  it("reads a value from the line after its label, as in a Word table", () => {
    const x = extractAgreement("## The owner\nName:\nDana Katz Ltd\nPhone:\n050-765-4321", own());
    expect(x.customer.name?.value).toBe("Dana Katz Ltd");
    expect(x.customer.phone?.value).toBe("+972507654321");
    expect(x.customer.kind.value).toBe("company");
  });

  it("recognizes sections without heading markers, as in documents written in Word", () => {
    const x = extractAgreement(
      "Property Management Agreement\nThe management company\nName: Some Company\nThe owner\nName: Dana Katz\nPhone: 050-765-4321\nManaged properties\nHerzl 12 / 5, Ramat Gan",
      own(),
    );
    expect(x.customer.name?.value).toBe("Dana Katz");
    expect(x.properties.map((p) => p.value)).toEqual(["Herzl 12 / 5, Ramat Gan"]);
  });

  it("reads labels with invisible characters and odd spacing, as copied from Word or a PDF", () => {
    const x = extractAgreement("## הבעלים\nש\u200bם\u00a0: \u200fדנה כץ\u200f\nטלפון :  \u202a050-765-4321\u202c\nדוא\u05f4ל：dana@example.com", own());
    expect(x.customer.name?.value).toBe("דנה כץ");
    expect(x.customer.phone?.value).toBe("+972507654321");
    expect(x.customer.email?.value).toBe("dana@example.com");
  });

  it("reads an owner living abroad, with a foreign phone number", () => {
    const x = extractAgreement("## The owner\nName: David Miller\nPhone: +44 20 7946 0958", own());
    expect(x.customer.phone?.value).toBe("+442079460958");
  });

  it("notices co-owners, a fee plus VAT, and an end date before the start", () => {
    const x = extractAgreement(
      "## הבעלים\nשם: אבי פרץ\nת.ז.: 034827139\nשם: רחל פרץ\nת.ז.: 207654328\n## תנאים\nתקופת ההסכם: 01/12/2027 – 01/12/2026\nדמי ניהול: ₪500 לחודש + מע\"מ",
      own(),
    );
    expect(x.customer.name?.value).toBe("אבי פרץ");
    expect(x.terms).toMatchObject({ feeModel: { value: "fixed" }, feeMinor: { value: 50000 }, plusVat: { value: true } });
    expect(x.warnings).toEqual(expect.arrayContaining(["multiple_owners", "end_before_start"]));
  });

  it("ignores impossible dates instead of guessing", () => {
    const x = extractAgreement("Term: 31/02/2026 – 31/12/2026\nName: Dana Katz\nPhone: 050-765-4321", own());
    expect(x.terms.startDate).toBeUndefined();
    expect(x.terms.endDate?.value).toBe("2026-12-31");
    expect(x.warnings).toContain("no_start");
  });

  it("warns about what is missing or wrong instead of guessing", () => {
    const x = extractAgreement("## הבעלים\nשם: פלוני\nת.ז.: 123456789", own());
    expect(x.warnings).toEqual(["invalid_tax_id", "no_contact", "no_start"]);
  });
});

describe("Word files", () => {
  it("keeps Hebrew, English, symbols and the headings", async () => {
    const blocks = toBlocks("# כותרת & Title\n## Section <1>\n- פריט\n[ ] check\n---\nשורה \"אחרונה\"");
    expect(await readDocxText(writeDocx(blocks, { rtl: true }))).toBe("# כותרת & Title\n## Section <1>\n• פריט\n☐ check\n\nשורה \"אחרונה\"");
  });

  it("reads compressed documents, as Word saves them", async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>שלום</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">world </w:t></w:r></w:p><w:p><w:r><w:t>&amp; more</w:t></w:r></w:p></w:body></w:document>';
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(xml));
        controller.close();
      },
    });
    const compressed = new Uint8Array(await new Response(source.pipeThrough(new CompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)).arrayBuffer());
    expect(await readDocxText(deflatedZip("word/document.xml", compressed, new TextEncoder().encode(xml).length))).toBe("שלום\tworld \n& more");
  });

  it("rejects files that are not Word documents", async () => {
    await expect(readDocxText(new TextEncoder().encode("plain text, not a zip"))).rejects.toThrow();
  });
});

/** A zip with one deflated entry (writeZip only stores), built by hand for the test above. */
function deflatedZip(name: string, data: Uint8Array, size: number): Uint8Array {
  const n = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + n.length);
  const l = new DataView(local.buffer);
  l.setUint32(0, 0x04034b50, true);
  l.setUint16(8, 8, true);
  l.setUint32(18, data.length, true);
  l.setUint32(22, size, true);
  l.setUint16(26, n.length, true);
  local.set(n, 30);
  const central = new Uint8Array(46 + n.length);
  const c = new DataView(central.buffer);
  c.setUint32(0, 0x02014b50, true);
  c.setUint16(10, 8, true);
  c.setUint32(20, data.length, true);
  c.setUint32(24, size, true);
  c.setUint16(28, n.length, true);
  central.set(n, 46);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, 1, true);
  e.setUint16(10, 1, true);
  e.setUint32(12, central.length, true);
  e.setUint32(16, local.length + data.length, true);
  const out = new Uint8Array(local.length + data.length + central.length + end.length);
  out.set(local, 0);
  out.set(data, local.length);
  out.set(central, local.length + data.length);
  out.set(end, local.length + data.length + central.length);
  return out;
}

// The layout of real management agreements (from the company's examples, with invented details):
// parties as "בין … לבין" blocks, the property in the recitals with its block and parcel, the term
// starting on signing, and a fee of "a percentage or a minimum, whichever is higher, plus VAT".
describe("agreements in the usual Israeli layout", () => {
  const filled = `הסכם ניהול
שנערך ונחתם ביום 15/01/2026

בין

\t\t\tעוגן ניהול נכסים בע"מ
\t\t\tמרחוב הדוגמה 1, תל אביב
\t\t\t(להלן: "חברת הניהול")\t\t\t\tמצד אחד

לבין

\t\t\tדנה כץ ת.ז. 207654328
\t\t\tמרח' הגפן 3, בת ים
\t\t\tטל: 050-765-4321
\t\t\t(להלן, ביחד ולחוד: "המזמין")\t\t\tמצד שני

הואיל\tוהמזמין הינו בעל מלוא הזכויות של דירת מגורים מס' 5 הנמצאת ברחוב הרצל 12 ברמת גן, הידוע כגוש 6123 חלקה 45 (להלן: "הנכס");
והואיל\tוהמזמין מעוניין שחברת הניהול תנהל את הנכס עבורו;
 תקופת ההסכם
 הצדדים מסכימים כי הסכם זה נקשר לתקופה של שנה אחת לפחות שתחילתה במועד חתימת הסכם זה.
 המזמין מיפה את כוחה של חברת הניהול לגבות דמי שכירות, דמי ניהול, ותשלומים אחרים משוכרים בנכס.
דמי ניהול והוצאות
בתמורה לביצוע התחייבויותיה מתחייב המזמין לשלם לחברת הניהול דמי ניהול חודשיים בסך השווה ל- 400 ₪ + מע"מ כדין או 8.5% + מע"מ מסך דמי השכירות החודשיים, לפי הגבוה מבניהם (להלן: "דמי הניהול").
תשלום דמי הניהול יבוצע בתחילת כל רבעון החל ממועד חתימת הסכם זה.
_______________\t\t\t_____________
           המזמין\t\t\t\t  חברת הניהול`;

  it("reads the owner from the second party block, never the company from the first", () => {
    const x = extractAgreement(filled, own());
    expect(x.customer).toMatchObject({
      name: { value: "דנה כץ" },
      taxId: { value: "207654328" },
      phone: { value: "+972507654321" },
      billingAddress: { value: "הגפן 3, בת ים" },
      kind: { value: "individual" },
    });
  });

  it("reads the fee as a percentage with a minimum, plus VAT, billed quarterly, from signing", () => {
    const x = extractAgreement(filled, own());
    expect(x.terms).toMatchObject({
      feeModel: { value: "percent_with_minimum" },
      feePercent: { value: 8.5 },
      feeMinor: { value: 40000 },
      plusVat: { value: true },
      billingFrequency: { value: "quarterly" },
      startDate: { value: "2026-01-15", how: "pattern" },
    });
  });

  it("finds the property in the recitals and matches it by block and parcel", async () => {
    const x = extractAgreement(filled, own());
    expect(x.properties.map((p) => p.value)).toEqual(["הרצל 12 ברמת גן (גוש 6123, חלקה 45)"]);
    expect((await api.matchProperties(x.properties.map((p) => p.value)))[0].property?.id).toBe("p1");
  });

  it("reads nothing personal from the blank template, and says what is missing", () => {
    const blank = filled
      .replace("15/01/2026", "__________")
      .replace("דנה כץ ת.ז. 207654328", "------ ת.ז. _________")
      .replace("הגפן 3, בת ים", "_________, בת ים")
      .replace("050-765-4321", "____________");
    const x = extractAgreement(blank, own());
    expect(x.customer.name).toBeUndefined();
    expect(x.customer.taxId).toBeUndefined();
    expect(x.customer.phone).toBeUndefined();
    expect(x.warnings).toEqual(expect.arrayContaining(["no_name", "no_contact", "no_start"]));
  });

  it("puts the parties right when the owner comes first", () => {
    const swapped = "בין\nדנה כץ, ת.ז. 207654328\n(להלן: \"הבעלים\") מצד אחד\nלבין\nעוגן ניהול נכסים\nטל: 03-555-0100\n(להלן: \"החברה\") מצד שני";
    const x = extractAgreement(swapped, own());
    expect(x.customer.name?.value).toBe("דנה כץ");
    expect(x.customer.phone).toBeUndefined(); // the only phone is the company's
  });
});

describe("fee and registry parsing", () => {
  it.each([
    ["6% משכר הדירה", { model: "percent_of_rent", percent: 6, plusVat: false }],
    ["₪620 לחודש בתוספת מע״מ", { model: "fixed", amountMinor: 62000, plusVat: true }],
    ["8.5% + מע\"מ או 400 ₪ + מע\"מ, לפי הגבוה", { model: "percent_with_minimum", percent: 8.5, amountMinor: 40000, plusVat: true }],
    ["7% of the rent or ₪350 per month, whichever is higher, plus VAT", { model: "percent_with_minimum", percent: 7, amountMinor: 35000, plusVat: true }],
    ["as agreed", { model: undefined }],
  ])("%s", (text, expected) => expect(parseFee(text)).toMatchObject(expected));

  it.each([
    ["הידוע כגוש 6123 חלקה 45", { block: "6123", parcel: "45" }],
    ["והידוע כחלקה 31 בגוש 8150", { block: "8150", parcel: "31" }],
    ["known as block 6123, parcel 45", { block: "6123", parcel: "45" }],
    ["parcel 31 in block 8150", { block: "8150", parcel: "31" }],
    ["דירה ברחוב הרצל", undefined],
  ])("%s", (text, expected) => expect(parseRegistry(text)).toEqual(expected));
});

describe("documents made from an agreement", () => {
  it.each(["ft2", "ft3", "ft4"])("%s fills every field it uses, for every sample agreement, in both languages", async (id) => {
    const template = db.formTemplates.find((t) => t.id === id)!;
    for (const a of db.agreements) {
      for (const language of ["he", "en"] as const) {
        const result = render(template.body[language]!, "agreement", await api.getFormValues("agreement", a.id, language));
        expect(result.unknown, `${a.id} ${language}`).toEqual([]);
        // Only details the record really lacks may be missing (an address, an end date, a registry number).
        const allowed = ["customer.billingAddress", "customer.email", "customer.taxId", "agreement.approvalThreshold", "property.block", "property.parcel"];
        expect(result.missing.filter((k) => !allowed.includes(k)), `${a.id} ${language}`).toEqual([]);
      }
    }
  });

  it("lists every owner who signs a power of attorney, with their ID", async () => {
    db.agreements.push({ ...db.agreements[0], id: "agP", number: 3999, customerId: "c6", propertyIds: ["p6"] });
    const values = await api.getFormValues("agreement", "agP", "he");
    expect(values["agreement.owners"]).toBe("- אבי ורחל פרץ\n- רונית שפירא"); // p6 is owned 50/50 by c6 and c5
  });
});
