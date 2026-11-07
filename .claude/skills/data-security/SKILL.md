---
name: data-security
description: Security and personal-data rules for this property-management repo. Use before any work that touches customer, owner or tenant data, documents (agreements, IDs, bank details), imports or exports, file uploads, logs, authentication, AI or LLM features, third-party services or new dependencies; whenever the user shares or points to a real document or real customer data; and before committing.
---

# Data security in this repository

This system holds owners' and tenants' personal data (names, ID numbers, phones, addresses, bank details, signed agreements). The repository is **public**. The full rules are in `docs/SECURITY.md`; read the relevant section before changing anything security-related.

## You are an AI model: don't take in real personal data

Anything you read is sent to a model provider. So:

- **Never read real customer documents or data**: files under `private/`, `.docx`, `.pdf`, `.xlsx`, exports, database dumps, `.env`. Reading them with the Read tool is blocked in `.claude/settings.json`; don't get around it with `cat`, `unzip`, `strings`, Python or any other command.
- If the user asks you to look at a real document (to debug an import, for example), don't open it. Ask them to make a redacted copy and check it themselves first:
  ```bash
  ! npm --prefix apps/admin run redact -- <path/to/file.docx> --known "<owner name>"
  ```
  Then read only `<file>.redacted.txt`. Redaction follows rules, so remind them to check the copy before you read it.
- Better still, rebuild the problem with invented details and add it as a test case.
- If real personal data shows up in the conversation anyway (pasted text, a log, a screenshot): don't repeat it, don't copy it into files, tests, commits or memory, and tell the user.

## When writing code

- **AI features:** text goes through `redact()` from `apps/admin/src/security/sensitive.ts` (Python port in `apps/api/core`) before any call to a model; values the system knows (the customer's name, address) go in `known`. Only redacted text leaves; `restore()` maps the answer back. Log the purpose and the token count, never the content. Use providers with no training and no retention. The output is a suggestion a person confirms.
- **Identifiers** (`taxId`, passport): shown with `SensitiveValue` (masked until revealed); never in URLs, logs, file names or error messages.
- **Documents:** read where they are opened (`readDocxText`, `extractAgreement`), never sent to an outside service; keep the size limits; don't store the text; never overwrite existing data on import.
- **Browser:** no personal data in `localStorage`, `sessionStorage`, URLs or `console.log`. No `dangerouslySetInnerHTML`. Keep the content security policy in `apps/admin/vite.config.ts` strict; don't add outside scripts, fonts or analytics.
- **Server (Phase 0 on):** permissions checked on the server for every call, export and file; row-level security per organization; audit log for reveals, exports and financial changes; secrets only in the environment / secret manager.
- **Dependencies:** pin exact versions; prefer the platform over a new library for small jobs; the build must pass `npm audit --omit=dev --audit-level=high`.
- **Tests:** a change to redaction or import rules comes with a test in `src/security/sensitive.test.ts` or `src/data/agreements.test.ts`. Test data is invented: `example.com` emails, made-up names, IDs that pass the check digit but belong to no one.

## Before committing

- `git diff --cached` contains no real names, IDs, phones, emails, addresses or bank details, and no keys or tokens.
- No documents (`*.docx`, `*.pdf`, `*.xlsx`) or redacted copies (`*.redacted.txt`) are staged; `.gitignore` excludes them, so don't force-add them.
- `npm test` passes (it includes the security tests). CI also runs `npm audit` and gitleaks.

## If something leaks

A key in a commit, a document in the repo, data sent to the wrong service: stop and tell the user right away. Rotate the key; don't just delete it, because it stays in git history. Follow `docs/SECURITY.md` §7.
