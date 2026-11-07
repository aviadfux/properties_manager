// Opening an uploaded document and getting its text, on the user's computer. The file's content
// decides what it is, not its name: a renamed PDF or an old Word file gets a clear message instead
// of garbage. Pure apart from the File API; used by the agreement import.
import { readDocxText } from "./docx";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARS = 300_000; // a long agreement is ~30,000 characters

export type DocumentProblem =
  | "too_large" // over MAX_FILE_BYTES
  | "empty" // no text: an empty file, or a scanned document (images only)
  | "legacy_word" // .doc (Word 97–2003), or a password-protected .docx: both are OLE files
  | "pdf" // not supported yet
  | "unsupported" // anything else
  | "unreadable"; // damaged

export class DocumentError extends Error {
  constructor(readonly problem: DocumentProblem) {
    super(problem);
  }
}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * Text files in any encoding Hebrew documents come in: UTF-8 (with or without a BOM), UTF-16 with
 * a BOM, and Windows-1255 (older Hebrew Windows programs) when the bytes are not valid UTF-8.
 */
export function decodeText(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1255").decode(bytes);
  }
}

/** Binary content that is not text (a renamed image or program). */
const looksBinary = (text: string) => (text.slice(0, 4000).match(/[\u0000-\u0008\u000e-\u001f�]/g)?.length ?? 0) > 20;

export async function readDocument(bytes: Uint8Array, fileName: string): Promise<string> {
  if (bytes.length > MAX_FILE_BYTES) throw new DocumentError("too_large");
  const name = fileName.toLowerCase();
  let text: string;
  if (startsWith(bytes, OLE)) throw new DocumentError("legacy_word");
  if (startsWith(bytes, PDF)) throw new DocumentError("pdf");
  if (startsWith(bytes, ZIP)) {
    try {
      text = await readDocxText(bytes);
    } catch {
      throw new DocumentError(name.endsWith(".docx") ? "unreadable" : "unsupported");
    }
  } else if (name.endsWith(".txt") || name.endsWith(".text") || !/\.[a-z0-9]+$/.test(name)) {
    text = decodeText(bytes);
    if (looksBinary(text)) throw new DocumentError("unsupported");
  } else if (name.endsWith(".doc")) {
    throw new DocumentError("legacy_word");
  } else throw new DocumentError("unsupported");

  text = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  if (!text.replace(/[\s_\-–—.]/g, "")) throw new DocumentError("empty");
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}

/** Reads a File chosen in the browser. */
export async function readDocumentFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new DocumentError("too_large");
  return readDocument(new Uint8Array(await file.arrayBuffer()), file.name);
}
