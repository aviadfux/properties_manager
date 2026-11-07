# Security and Personal Data

The system holds owners' and tenants' personal data: names, ID numbers, phone numbers, addresses, bank details, signed agreements. This file is the set of rules for the code, the team and AI tools. Requirements come from the spec (§8 Privacy and Data Protection, §9 AI Assistance, §9 Reliability and Security); the law is Israel's Privacy Protection Law and its Data Security Regulations (GDPR where relevant).

## 1. Data classification

| Class | Examples | Rules |
|---|---|---|
| **Identifier** | ID / company number (`tax_id`), passport | Encrypted at rest (column-level); masked on screen until revealed (`SensitiveValue`); the reveal is written to the audit log; never in URLs, logs or file names |
| **Financial** | Bank account, IBAN, card numbers | Full card numbers are never stored (spec §9). Bank details only where a payment needs them |
| **Contact** | Name, phone, email, postal address | Shown to users whose role needs them (spec §8); never in logs or error reports |
| **Documents** | Signed agreements, ID copies, payment proofs | Private file storage, time-limited links, scanned on upload; never in the database as text, never in the repository |
| **Free text** | Notes, messages, issue descriptions | May contain any of the above: treated as personal data |
| **Not personal** | Property type, area, amounts, dates, issue categories | — |

Collect only what a feature needs. When a field is not needed any more, delete it according to the retention policy (spec §8).

## 2. AI models

**Personal data is never sent to an AI service.** Not by the system, and not by the people building it.

In the system (when an AI feature is added, spec §9):

1. The text goes through `redact()` (`apps/admin/src/security/sensitive.ts`; Python port in `apps/api/core`) before it leaves. Names, IDs, phones, emails, addresses, bank and card details become tokens such as `[NAME_1]`; the same value always gets the same token.
2. Only the redacted text is sent. The token → value map stays in the system; `restore()` puts the real values back into the answer.
3. Values the system already knows (the customer's name, address) are passed to `redact()` as `known`, because free text can mention them without a label.
4. Providers: no training on our data, no retention (zero-data-retention terms), a data-processing agreement, data stored in an approved region. Keys in the secret manager, never in code.
5. Every call is logged with its purpose, the user and the token count — never the content.
6. AI output is a suggestion that a person confirms (spec §9). It never approves, verifies or issues anything.
7. A feature that cannot work on redacted text does not use AI.

The agreement import (`apps/admin/src/data/agreements.ts`) reads documents with fixed rules, inside the system, with no AI. Its "Privacy check" panel shows the redacted text — what an AI service would receive if AI-assisted reading is added later.

### Local redaction model (planned with the first AI feature)

The rules in `redact()` reliably catch structured details (IDs, phones, emails, bank and card numbers, anything after a label). They can miss a name or address written in free text without a label ("the tenant Moshe called about Herzl 12"). A **local** entity-recognition model closes that gap. It never replaces the rules.

```
text ─► 1. known values ─► 2. rules (redact) ─► 3. local NER model ─► 4. leak check ─► external AI
         (DB: name,          IDs, phones,         names, places,         known values +
          address, phone)    emails, labels…      organizations          rule patterns again
                                                                              │ any hit → block + log
```

1. **Layers, combined.** Everything any layer flags is hidden: the customer's known details from the database, the rules, and the model's findings. Same value → same token, as today.
2. **A span-tagging model, not a chat model.** A token-classification (NER) model marks exact spans and cannot rewrite or invent text; it runs on an ordinary CPU. Candidates for Hebrew: the DictaBERT models from Dicta (a NER variant); for English, standard NER models. Microsoft Presidio (open source, Python) is a framework for combining recognizers and accepts custom models. A local generative model (via Ollama) is a fallback only: slower, needs more hardware, and its output must be checked against the input (no added or changed text). Candidates are evaluated on our test set before one is chosen.
3. **Where it runs.** In the Python backend (`apps/api/core/redaction`), as a separate worker **without internet access**. Model files are downloaded once, pinned to a version and checked by hash. Nothing about the text is logged.
4. **Fail closed.** If the model is not available or times out, nothing is sent to the external AI — never a fallback to rules alone.
5. **Leak check before sending.** The outgoing text is scanned again for every known detail of the record and for the rule patterns; any hit blocks the call and is written to the audit log (without the value).
6. **Measured, not assumed.** A labeled test set of invented Hebrew and English texts (agreements, issue descriptions, messages, with names and addresses in free text) measures recall per entity type. Target: no missed ID, phone, email or bank detail; names and addresses ≥ 99% recall with the combined layers. Re-measured on every model or rule change (CI).
7. **Local first.** Where the local model can do the task itself (e.g. sorting an issue into a category), nothing is sent outside at all.

Known limits: no model reaches 100%; Hebrew NER is weaker than English, especially for names that are also common words (אור, שקד). That is why the layers are combined, the leak check blocks, and a person reviews AI output.

While building (Claude Code, ChatGPT, any assistant): see §6.

## 3. Documents and files

- Read where they are opened: the manager's browser now, the API later. Never sent to an outside service to be read or converted.
- Accepted: `.docx` and `.txt` up to 5 MB (PDF later, read on the server). The Word reader checks the archive and stops at 20 MB of text (protection against zip bombs).
- The text of an imported document is not stored; the original file goes to private storage (`file_id`), behind permission checks and time-limited links.
- Imports never overwrite existing details; the user checks every value before it is saved.

## 4. The application

| Control | Where |
|---|---|
| Content security policy: code, styles, fonts and data only from the app itself | `apps/admin/vite.config.ts` (built app) |
| No referrer: internal addresses are not passed to linked sites (e.g. wa.me) | `apps/admin/index.html` |
| React escapes all text; no `dangerouslySetInnerHTML` | all components |
| Personal data only in memory or in the database — never in `localStorage`, URLs or logs (the app stores only the UI language) | `apps/admin/src/i18n` |
| Phase 0 (server): 2FA, roles checked on the server for every call, export and file (spec §8), row-level security per organization, audit log, rate-limited login, encryption in transit and at rest, security headers (`frame-ancestors 'none'`, HSTS, `X-Content-Type-Options`) | `apps/api` |

## 5. The code and the repository

The repository is **public**.

- No real data, ever: sample and test data are fictitious (`example.com` emails, invented names and numbers). Real documents stay outside the repository; `.gitignore` excludes `private/`, `*.docx`, `*.pdf`, `*.xlsx` and redacted copies.
- No secrets: `.env` files are ignored; keys live in the secret manager. CI scans the whole history for keys and passwords (gitleaks) on every push.
- Dependencies: exact versions, a lock file, `npm audit` (high and critical) in CI for both apps. Prefer the platform over a new library when the job is small (the Word reader and writer use the browser's built-in decompression instead of a zip library).
- Every change runs the security tests (`src/security/sensitive.test.ts`, the agreement import tests).

## 6. Working with AI coding assistants

Claude Code in this repo loads the `data-security` skill (`.claude/skills/data-security/SKILL.md`) and is blocked from reading `private/`, Word, PDF and Excel files and `.env` files (`.claude/settings.json`).

- Never paste or attach a real agreement, ID, bank statement or customer list into an assistant.
- To debug with a real document, make a redacted copy first, read it yourself, and share only the copy:

  ```bash
  cd apps/admin
  npm run redact -- ~/Documents/agreement.docx --known "Owner Name"   # .docx, .txt, and .doc on macOS
  # → ~/Documents/agreement.redacted.txt
  ```

- Better still, reproduce the problem with invented details and add it as a test case.

## 7. Incidents

If personal data may have been exposed (a lost laptop, a key in a commit, a document sent to the wrong place): revoke keys and sessions first, then record what was exposed, to whom and when, and follow the breach-notification procedure (spec §8; the Privacy Protection Authority must be notified of a serious incident). A secret found in git history is rotated, not just deleted.
