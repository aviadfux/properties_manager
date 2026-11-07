// Makes a copy of a document with the personal details replaced by tokens ([NAME_1], [PHONE_1]…),
// so that only the copy is ever shared: with an AI assistant, in a bug report, or as a test example.
// Runs on this computer; nothing is sent anywhere. Uses the same rules as the app (src/security/sensitive.ts).
//
//   npm run redact -- path/to/agreement.docx [--known "Moshe Levi" --known "Herzl 12"]
//
// Reads .docx and .txt everywhere, and old .doc files on macOS (with the built-in textutil).
//
// Writes path/to/agreement.redacted.txt and prints what kinds of details were hidden (never the values).
// Redaction is rule-based: read the copy before sharing it.
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { basename, dirname, extname, join } from "node:path";
import { readDocxText } from "../src/data/docx.ts";
import { redact } from "../src/security/sensitive.ts";

const args = process.argv.slice(2);
const known = [];
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--known") known.push({ kind: "NAME", value: args[++i] ?? "" });
  else files.push(args[i]);
}
if (files.length !== 1) {
  console.error('Usage: npm run redact -- <file.docx|file.txt> [--known "a name to hide"]');
  process.exit(1);
}

const file = files[0];
const extension = extname(file).toLowerCase();
if (![".docx", ".txt", ".doc"].includes(extension) || (extension === ".doc" && process.platform !== "darwin")) {
  console.error(".docx and .txt files are supported (and .doc on macOS). Save other files as .docx first.");
  process.exit(1);
}
let text;
if (extension === ".doc") {
  // macOS converts old Word files locally; no file leaves the computer.
  const { stdout } = await promisify(execFile)("textutil", ["-convert", "txt", "-stdout", file], { maxBuffer: 20 * 1024 * 1024 });
  text = stdout;
} else {
  const data = await readFile(file);
  text = extension === ".docx" ? await readDocxText(new Uint8Array(data)) : data.toString("utf8");
}
const { text: safe, redactions } = redact(text, known);

const out = join(dirname(file), `${basename(file, extension)}.redacted.txt`);
await writeFile(out, safe);
const counts = Object.entries(Object.groupBy(redactions, (r) => r.kind)).map(([kind, rows]) => `${kind} ×${rows.length}`);
console.log(`Wrote ${out}`);
console.log(`Hidden: ${counts.join(", ") || "nothing found"}`);
console.log("Read the copy before sharing it: names and addresses in free text are hidden only when labeled or passed with --known.");
