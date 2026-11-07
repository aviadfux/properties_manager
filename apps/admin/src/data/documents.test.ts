// Opening uploaded files: what a file is depends on its content, and every problem has a clear answer.
import { describe, expect, it } from "vitest";
import { DocumentError, MAX_FILE_BYTES, MAX_TEXT_CHARS, readDocument } from "./documents";
import { documentXmlToText, readDocxText, writeDocx, writeZip } from "./docx";
import { toBlocks } from "./templates";

const enc = (s: string) => new TextEncoder().encode(s);
const problem = (p: Promise<unknown>) => p.then(() => "read", (e) => (e instanceof DocumentError ? e.problem : `other: ${e}`));
const docx = (xml: string, extra: [string, string][] = []) =>
  writeZip([["word/document.xml", `<w:document><w:body>${xml}</w:body></w:document>`], ...extra]);

describe("recognizing files by their content", () => {
  it("reads Word files whatever their name", async () => {
    const bytes = writeDocx(toBlocks("שם: משה"), { rtl: true });
    expect(await readDocument(bytes, "agreement.docx")).toBe("שם: משה");
    expect(await readDocument(bytes, "agreement")).toBe("שם: משה");
  });

  it.each([
    ["an old Word file", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1, 2]), "a.doc", "legacy_word"],
    ["an old Word file renamed to .docx (or a password-protected one)", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "a.docx", "legacy_word"],
    ["a PDF renamed to .txt", enc("%PDF-1.7 ..."), "a.txt", "pdf"],
    ["a zip that is not a Word file", writeZip([["notes.txt", "hello"]]), "a.zip", "unsupported"],
    ["a damaged .docx", enc("PK\u0003\u0004 broken"), "a.docx", "unreadable"],
    ["an image renamed to .txt", new Uint8Array(Array.from({ length: 200 }, (_, i) => i % 32)), "a.txt", "unsupported"],
    ["a spreadsheet", enc("a,b"), "a.xlsx", "unsupported"],
    ["an empty file", new Uint8Array(), "a.txt", "empty"],
    ["only blanks to fill in", enc("  ____ \n ---- \n"), "a.txt", "empty"],
    ["a Word file with no text (a scan)", docx("<w:p><w:r><w:drawing/></w:r></w:p>"), "scan.docx", "empty"],
    ["a file over 5 MB", new Uint8Array(MAX_FILE_BYTES + 1), "a.txt", "too_large"],
  ])("rejects %s", async (_, bytes, name, expected) => {
    expect(await problem(readDocument(bytes, name))).toBe(expected);
  });

  it("cuts extremely long text instead of freezing the page", async () => {
    expect((await readDocument(enc("א".repeat(MAX_TEXT_CHARS + 10)), "a.txt")).length).toBe(MAX_TEXT_CHARS);
  });
});

describe("text encodings of Hebrew files", () => {
  it("reads UTF-8 with and without a byte-order mark", async () => {
    expect(await readDocument(enc("שם: דנה"), "a.txt")).toBe("שם: דנה");
    expect(await readDocument(new Uint8Array([0xef, 0xbb, 0xbf, ...enc("שם: דנה")]), "a.txt")).toBe("שם: דנה");
  });

  it("reads UTF-16 (Windows 'Unicode' text)", async () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...[..."שם"].flatMap((ch) => [ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8])]);
    expect(await readDocument(utf16, "a.txt")).toBe("שם");
  });

  it("reads Windows-1255 (older Hebrew programs)", async () => {
    // "שם: דנה" in Windows-1255: Hebrew letters are 0xE0–0xFA.
    const cp1255 = new Uint8Array([0xf9, 0xed, 0x3a, 0x20, 0xe3, 0xf0, 0xe4]);
    expect(await readDocument(cp1255, "a.txt")).toBe("שם: דנה");
  });

  it("normalizes Windows line endings", async () => {
    expect(await readDocument(enc("a: 1\r\nb: 2\rc: 3"), "a.txt")).toBe("a: 1\nb: 2\nc: 3");
  });
});

describe("Word details", () => {
  it("leaves out text deleted with tracked changes, and field codes", () => {
    const xml =
      '<w:body><w:p><w:r><w:t>Phone: </w:t></w:r><w:del><w:r><w:delText>050-000-0000</w:delText></w:r></w:del>' +
      '<w:ins><w:r><w:t>052-123-4567</w:t></w:r></w:ins><w:r><w:fldChar/><w:instrText> HYPERLINK "x" </w:instrText></w:r></w:p></w:body>';
    expect(documentXmlToText(xml)).toBe("Phone: 052-123-4567");
  });

  it("keeps tabs, line breaks and non-breaking hyphens, but not paragraph tab settings", () => {
    const xml =
      '<w:body><w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t><w:noBreakHyphen/><w:t>d</w:t></w:r></w:p></w:body>';
    expect(documentXmlToText(xml)).toBe("a\tb\nc-d");
  });

  it("finds the main part through the package relationships", async () => {
    const bytes = writeZip([
      ["_rels/.rels", '<Relationships><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/word/main.xml"/></Relationships>'],
      ["word/main.xml", "<w:document><w:body><w:p><w:r><w:t>found</w:t></w:r></w:p></w:body></w:document>"],
    ]);
    expect(await readDocxText(bytes)).toBe("found");
  });

  it("drops characters Word does not allow, instead of writing a broken file", async () => {
    const bytes = writeDocx(toBlocks("Name: Dana\u0001\u0007 Katz\u000b"), { rtl: false });
    expect(await readDocxText(bytes)).toBe("Name: Dana Katz");
  });
});
