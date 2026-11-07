// Reading the text of a Word (.docx) file and writing a simple one, with no library: a .docx is a
// zip archive whose text is in word/document.xml. Everything happens where the code runs (the
// manager's browser, or Node for scripts/redact.mjs) — the file is never sent anywhere to be read.
//
// Only what agreements need: paragraphs of text (no images, tables become one line per cell).
import type { Block } from "./templates";

const MAX_TEXT_BYTES = 20 * 1024 * 1024; // guards against "zip bombs" that expand to huge sizes

// ---------- reading ----------

/** The text of a .docx file, one paragraph per line. */
export async function readDocxText(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // The main part is usually word/document.xml; the package's relationships say for sure.
  const rels = await readZipEntry(bytes, "_rels/.rels");
  const target = rels && /Type="[^"]*\/officeDocument"[^>]*Target="\/?([^"]+)"|Target="\/?([^"]+)"[^>]*Type="[^"]*\/officeDocument"/.exec(new TextDecoder().decode(rels));
  const xml = (target && (await readZipEntry(bytes, target[1] ?? target[2]))) || (await readZipEntry(bytes, "word/document.xml"));
  if (!xml) throw new Error("Not a Word document");
  return documentXmlToText(new TextDecoder().decode(xml));
}

/**
 * Only real text: runs (w:t), tabs, line breaks and non-breaking hyphens. Text deleted in tracked
 * changes (w:delText), field codes (w:instrText) and everything else in the XML is left out.
 * Headings written by writeDocx (outline level 0 / 1) come back as "# " / "## ", as in templates.
 */
export function documentXmlToText(xml: string): string {
  const body = xml.replace(/^[\s\S]*?<w:body>/, "");
  return body
    .split(/<\/w:p>/)
    .map((p) => {
      let text = "";
      for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<w:noBreakHyphen\s*\/>/g)) {
        text += m[1] !== undefined ? decodeEntities(m[1]) : m[0].startsWith("<w:tab") ? "\t" : m[0].startsWith("<w:noBreak") ? "-" : "\n";
      }
      const level = /<w:outlineLvl w:val="(\d)"\s*\/>/.exec(p);
      return level && text ? `${"#".repeat(Number(level[1]) + 1)} ${text}` : text;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** One file from a zip archive, found through the archive's central directory. */
async function readZipEntry(bytes: Uint8Array, name: string): Promise<Uint8Array | undefined> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The "end of central directory" record is in the last 64 KB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return undefined;
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) return undefined;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localHeader = view.getUint32(p + 42, true);
    if (new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength)) === name) {
      if (size > MAX_TEXT_BYTES) throw new Error("Document too large");
      const start = localHeader + 30 + view.getUint16(localHeader + 26, true) + view.getUint16(localHeader + 28, true);
      const raw = bytes.subarray(start, start + compressedSize);
      if (method === 0) return raw;
      if (method === 8) return inflate(raw);
      throw new Error(`Unsupported compression ${method}`);
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  return undefined;
}

/** Decompresses with the browser's (and Node's) built-in DecompressionStream, stopping at the size limit. */
async function inflate(raw: Uint8Array): Promise<Uint8Array> {
  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(raw);
      controller.close();
    },
  });
  const reader = input.pipeThrough(new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_TEXT_BYTES) {
      await reader.cancel();
      throw new Error("Document too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// ---------- writing ----------

// Characters XML 1.0 does not allow (control characters pasted from other programs): Word refuses
// a file that contains them, so they are dropped.
const XML_INVALID = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;
const escapeXml = (s: string) => s.replace(XML_INVALID, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type ParagraphStyle = { rtl: boolean; bold?: boolean; size?: number; center?: boolean; border?: boolean; level?: number };

function paragraph(text: string, { rtl, bold = false, size = 22, center = false, border = false, level }: ParagraphStyle) {
  const pPr = [
    rtl ? "<w:bidi/>" : "",
    border ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>' : "",
    '<w:spacing w:after="120"/>',
    center ? '<w:jc w:val="center"/>' : "",
    level === undefined ? "" : `<w:outlineLvl w:val="${level}"/>`, // a heading in Word's navigation pane
  ].join("");
  const rPr = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>',
    bold ? "<w:b/><w:bCs/>" : "",
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
    rtl ? "<w:rtl/>" : "",
  ].join("");
  const run = text ? `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>` : "";
  return `<w:p><w:pPr>${pPr}</w:pPr>${run}</w:p>`;
}

/** A Word document from the blocks of a rendered form (see toBlocks in templates.ts). */
export function writeDocx(blocks: Block[], { rtl }: { rtl: boolean }): Uint8Array<ArrayBuffer> {
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case "title":
          return paragraph(b.text, { rtl, bold: true, size: 32, center: true, level: 0 });
        case "section":
          return paragraph(b.text, { rtl, bold: true, size: 26, border: true, level: 1 });
        case "subsection":
          return paragraph(b.text, { rtl, bold: true, size: 22, level: 2 });
        case "bullet":
          return paragraph(`• ${b.text}`, { rtl });
        case "checkbox":
          return paragraph(`☐ ${b.text}`, { rtl });
        case "divider":
          return paragraph("", { rtl, border: true });
        default:
          return paragraph(b.text, { rtl });
      }
    })
    .join("");
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body +
    `<w:sectPr>${rtl ? "<w:bidi/>" : ""}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>` +
    "</w:body></w:document>";
  return writeZip([
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ],
    ["word/document.xml", document],
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Uint8Array) => (data.reduce((c, byte) => CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

const DOS_DATE = (1 << 5) | 1; // 1 Jan 1980: entries carry no real date

/** A zip archive with uncompressed ("stored") entries — valid for Word, and simple. */
export function writeZip(files: [name: string, content: string | Uint8Array][]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true); // version needed
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(12, DOS_DATE, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const e = new DataView(entry.buffer);
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true);
    e.setUint16(6, 20, true);
    e.setUint16(8, 0x0800, true);
    e.setUint16(14, DOS_DATE, true);
    e.setUint32(16, crc, true);
    e.setUint32(20, data.length, true);
    e.setUint32(24, data.length, true);
    e.setUint16(28, nameBytes.length, true);
    e.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    local.push(header, data);
    central.push(entry);
    offset += header.length + data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, files.length, true);
  v.setUint16(10, files.length, true);
  v.setUint32(12, centralSize, true);
  v.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let p = 0;
  for (const part of [...local, ...central, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
