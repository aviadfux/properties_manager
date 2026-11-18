---
name: bilingual-spec-files
description: Hebrew and English spec docx files must be kept parallel; English is generalized (no names)
metadata:
  type: feedback
---

User maintains two parallel spec files in Markdown: docs/SPEC.en.md (source language) and docs/SPEC.he.md (Hebrew translation, wrapped in <div dir="rtl">). Both are generic: no personal names ("איתי" → "the Managing Director" / "המנהל הראשי"), no company name, providers only as examples. The original company-specific Hebrew v1.1 docx is kept only in the git-ignored private/ folder.

**Why:** user asked for two parallel files, then (2026-10-25) said the Hebrew must be a translation of the English and equally generic. The GitHub repo is public, so nothing company-specific may be committed.
**How to apply:** edit both .md files directly for every change, same place, same headings/tables/numbering (user dropped .docx on 2026-10-25 because generated duplicates were confusing). Spec is v1.2. Related: [[generic-product-single-company]].
