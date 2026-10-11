# Clinic Demo

Static, database-free demo of the Clinic Management System (data in `localStorage`, deployed on Vercel). The full plan and task list are in [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md). Read it first and follow it.

The source app is `E:\claude DR SaaS`. Read it for business rules, response shapes and seed data, but **never modify it**.

## Workflow
- Work through the tasks in `docs/DEMO_PLAN.md` in order (D-01, D-02, …), one after another, without stopping for unimportant questions; stop only for decisions that truly block.
- Per task: branch `feature/D-<nn>-<short-name>`, implement, add tests for the task, tick its checkboxes in the plan (add a `Note:` line for any deviation), commit with a Conventional Commit scoped by the task ID (for example `feat(D-04): …`), squash-merge into local `main`, delete the branch.
- Commit only when lint, tests and build are green, and gate on the real exit code (`if npm run lint && npx vitest run --maxWorkers=4 && npm run build; then git commit …; fi`), never on a piped `| tail`. oxlint prints nothing when not on a TTY: use `npx oxlint --format=default --deny-warnings` and require "Found 0 warnings and 0 errors".
- **Do not push** to origin; the user pushes.

## Rules that must not change
- Revenue counts on the **visit's date** (including later installments); dashboard cards count **visits**, not patients.
- Money is piastre-exact: compute in integer piastres.
- Timezone Africa/Cairo; compare days by date string (DST starts at midnight).
- `ar.json` and `en.json` must have identical keys (Arabic plurals need all six forms in both files).
- Every `<form>` uses the shared `components/form/Form`; new text colours must pass `npm run check:contrast`.

## Machine notes (Windows)
- Git Bash rewrites args like `/doctor` into Windows paths; use `MSYS_NO_PATHCONV=1`.
- Python writes CRLF unless you pass `newline=''`.
- The Vite watcher sometimes serves stale modules: kill :5173, delete `frontend/node_modules/.vite`, restart.
