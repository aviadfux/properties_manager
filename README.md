# Property Management System

A management system for property management companies: clients and leads, properties and buildings, agreements, recurring billing, payment requests and documents, maintenance with expense approvals, and a tenant portal. Built as a generic multi-organization product, deployed first for a single company.

## Repository layout

| Path | Contents |
|---|---|
| `Property_Management_CRM_Specification_EN.docx` | Specification, English (source language) |
| `Property_Management_CRM_Specification_HE.docx` | Specification, Hebrew (translation of the English) |
| `spec/` | Source for both specification files — edit here, not in Word |
| `docs/BUILD_PLAN.md` | Stack, architecture and phased build plan |

## Updating the specification

Both `.docx` files are generated so the two languages stay in sync; English is the source and Hebrew its translation. Add the change, in both languages, to `CHANGES` in `spec/build_spec.py`, then run:

```bash
python3 -I spec/build_spec.py
```
