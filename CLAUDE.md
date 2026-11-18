# Notes for Claude Code

Property management system, built by the user and Claude in this repo. Read before starting work:

1. **Latest session handoff:** the newest file in [.claude/sessions/](.claude/sessions/), with what was done, what is unverified and the next steps.
2. **Project memory:** [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) — decisions and the user's preferences, one file per fact. When a new durable decision is made, add or update a file there (same format) so it travels with the repo.
3. **Plan and rules:** [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) (current phase), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/SECURITY.md](docs/SECURITY.md), [README.md](README.md) (how to run each app).

## Must-follow rules

- **Public repository, personal data.** Follow the `data-security` skill (`.claude/skills/data-security/SKILL.md`). Never read real customer documents or `.env`; test data is invented (`example.com`).
- **Python first.** Business logic, API, jobs in Python (`apps/api`); keep TypeScript thin and explain it.
- **Spec in two languages.** Every change to `docs/SPEC.en.md` goes into `docs/SPEC.he.md` in the same place.
- **Every new table** gets row-level security in its migration (`app/db/rls.py`); `tests/test_isolation.py` checks it.
- Before committing: `npm test` in `apps/admin`, `uv run ruff check . && uv run pytest` in `apps/api`.

## Ending a session

Write or update `.claude/sessions/<date>-<topic>.md`: what was asked, decided, built, verified (and what was not), next steps. Summaries only — never paste conversation transcripts, which can contain personal data.
