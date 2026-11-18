---
name: no-whatsapp-integration
description: User decided not to integrate WhatsApp; WhatsApp messages are prepared and sent by hand via a pre-filled wa.me chat
metadata:
  type: project
---

Decided 2026-11-05: no WhatsApp Business Platform integration for now. In the app, WhatsApp shows as an icon/badge; a WhatsApp message (e.g. a payment reminder) is created with status `ready` and sent by the user in one click from a pre-filled `wa.me` chat, then recorded as `sent`. Email is sent by the system.

**Why:** user said "don't implement the whatsapp integration, just show the icon or something like that".
**How to apply:** don't plan or build WhatsApp API sending; keep channel = whatsapp as a manual, one-click flow. Related: [[domain-model-decisions]], [[build-team-and-plan]].
