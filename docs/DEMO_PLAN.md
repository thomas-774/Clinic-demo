# Clinic Demo — Plan

A static demo of the Clinic Management System that runs **without a database or backend**. All data lives in the browser's `localStorage`, so the site can be deployed to **Vercel** as plain static files. It looks and behaves like the real app, and it has quick buttons to enter as **Doctor**, **Patient** or **Assistant**.

- **Source app (read-only, do not change):** `E:\claude DR SaaS`
  - Frontend: `E:\claude DR SaaS\frontend` (React 19 + Vite, React Router, TanStack Query, Tailwind 4, react-i18next, Arabic default + English)
  - Backend (only to read the business rules): `E:\claude DR SaaS\backend` (Laravel 13)
  - Demo data source: `backend/database/seeders/DemoSeeder.php`, `DrugSeeder.php`, `DoctorSeeder.php`, `AssistantSeeder.php`
  - Manual walkthrough: `E:\claude DR SaaS\docs\walkthrough.md`
- **This repo:** `E:\Clinic-demo` (remote `https://github.com/thomas-774/Clinic-demo.git`)

---

## 1. Idea

Every page calls the API only through `frontend/src/api/*.js`, which all use one axios instance in `frontend/src/api/client.js`. The demo replaces only the **transport**:

```
Pages (unchanged) → api/*.js (unchanged) → client.js → axios adapter → src/demo/ fake backend → localStorage
```

Pages, hooks, components, i18n and styles stay the same as the source app. The new code goes in `frontend/src/demo/`, plus small changes in `client.js`, the login page and the layouts.

## 2. Decisions (already taken)

| Topic | Decision |
| --- | --- |
| Storage | One JSON object in `localStorage` key `clinic-demo.db` (+ `clinic-demo.version`). Wrap every read and write in try/catch; if storage is blocked, keep the data in memory only. |
| Per visitor | Each browser has its own data. Nothing is shared. **Reset demo** restores the seed. |
| Revenue rule | Revenue counts on the **visit date** (all payments of a visit, including later installments), and dashboard cards count **visits** (completed or walk-in), not patients. A visit for an appointment takes the appointment's date. Same as the source app's `ReportService`. Do NOT change this. |
| Visit export | `pdf` → open the browser print view of the visit (or generate a simple printable HTML). `docx` → hide the button in demo mode, or show "Not available in the demo". |
| Prescription print | Already browser-only. No change. |
| Health / Status page | `/health` returns OK with `demo: true`. |
| Latency | Fake delay of about 150–300 ms per request, so loading skeletons still show. |
| Deploy | Vercel, static `dist`, SPA rewrite. No env vars needed. |

## 3. API surface to fake

Taken from `frontend/src/api/*.js` (prefix is `VITE_API_URL`, usually `/api/v1`). Re-check with grep before starting; this list must match exactly.

**Auth:** `POST /auth/login` (`{ login, password }`), `POST /auth/register`, `POST /auth/logout`, `GET /me`
**Public:** `GET /health`, `GET /slots`

**Doctor**
- Patients: `GET /doctor/patients`, `POST /doctor/patients`, `GET|PUT /doctor/patients/{id}`
- History: `POST /doctor/patients/{id}/history`, `PUT|DELETE /doctor/patients/{id}/history/{entryId}`
- Visits: `POST /doctor/visits`, `PUT /doctor/visits/{id}`, `POST /doctor/visits/{id}/payments`, `GET /doctor/visits/{id}/export?format=pdf|docx` (blob)
- Prescriptions: `GET|POST /doctor/patients/{id}/prescriptions`, `GET|PUT|DELETE /doctor/prescriptions/{id}`
- Drugs: `GET /doctor/drugs/search`, `GET|PUT /doctor/drugs/{id}`, `POST /doctor/drugs`
- Schedule: `GET|POST /doctor/appointments`, `PATCH /doctor/appointments/{id}/status`, `GET|POST /doctor/blocked-times`, `DELETE /doctor/blocked-times/{id}`, `GET|PUT /doctor/working-hours`
- Reports: `GET /doctor/reports/summary`, `/daily-revenue`, `/payments`, `/outstanding`
- Settings: `GET|PUT /doctor/settings`
- Staff: `GET|POST /doctor/staff`, `PUT /doctor/staff/{id}`
- Audit: `GET /doctor/audit-logs`

**Assistant:** `GET /assistant/appointments`, `POST /assistant/appointments`, `PATCH /assistant/appointments/{id}/status`, `GET|POST /assistant/patients`, `GET|PUT /assistant/patients/{id}`, `GET /assistant/visits/unpaid`, `POST /assistant/visits/{id}/payments`

**Patient:** `GET|PATCH /patient/profile`, `GET|POST /patient/appointments`, `PATCH /patient/appointments/{id}/cancel`

For each route, read the matching Laravel controller, FormRequest and API Resource in the source backend, and copy:
- the **response JSON shape** (field names, nesting, `data` wrapper, pagination `meta`/`links`),
- the **validation rules** and the **422 error shape** (`{ message, errors: { field: [msg] } }`), in the request's `Accept-Language` (ar/en). Messages come from `backend/lang/{ar,en}`,
- the **status codes** (201 on create, 204 on delete, 403 on the wrong role, 404, **409 when a booking slot is already taken**),
- the **query params** (search, filters, page, per_page, dates).

## 4. Business rules to port (PHP → JS)

From `backend/app/Services/`, about 870 lines in total:

| Service | What to port |
| --- | --- |
| `SlotService.php` | Slot generation from working hours, slot length, blocked times and existing appointments; past slots hidden. Timezone is **Africa/Cairo**; compare dates as strings (DST starts at midnight). |
| `BookingService.php`, `AppointmentService.php` | Patient and staff booking, 409 on a taken slot, cancel rules, allowed status changes. |
| `PaymentService.php` | Payments, remaining balance (**piastre-exact**: work in integer piastres), paid / partial / unpaid, unpaid visits list. |
| `ReportService.php` + `VisitReport/` | Summary cards, daily revenue, payments list, outstanding, all by **visit date**. |
| `PrescriptionService.php` | Create, update and delete prescriptions with drug lines. |
| `PatientAccountService.php` | Registering a patient account and linking it to a patient record. |
| `AuditLogger.php` | Write audit entries on writes so the Activity page has data. |

Also check the Policies/Controllers for **role checks**: doctor-only, assistant-only and patient-only routes must return 403 for the wrong role (the source has a permissions test in `backend/tests`, use it as the reference).

## 5. Seed data

Convert to `frontend/src/demo/seed.js` (or `seed.json` + a builder):
- **Doctor**: from `DoctorSeeder` (clinic settings, working hours). Login phone `01000000000`, password `password`.
- **Assistant**: `AssistantSeeder`, phone `01100000000`, password `password`.
- **Patients**: 30 from `DemoSeeder` (phones `01020000001`…`01020000030`, password `password`). Patient #1 has a login account for the Patient button.
- About a month of past appointments, visits and payments (fully paid, installments, still owing), no-shows, cancellations, walk-ins, 7 days of upcoming bookings, medical history entries, some prescriptions.
- **Drugs**: from `DrugSeeder` (and any data file it reads).

Dates must be **relative to today** (built when the seed runs), so the schedule and reports never look empty. Use a fixed random seed (a small PRNG such as mulberry32) so the data is the same every time.

Store a `SEED_VERSION`; if the stored version is older, re-seed automatically.

## 6. Tasks

Do them in order. One branch and one commit per task (see `CLAUDE.md` for the workflow).

### D-01 Bring in the frontend and make it build
- [x] Make sure `frontend/` is a full copy of `E:\claude DR SaaS\frontend` **without** `node_modules`, `dist*`, `coverage`, `mobile-audit` output, `a11y-audit-results.json` and `.env` (as of 2026-10-11 the copy is missing `src/`, `public/` and `scripts/`).
  - Note: the copy was already complete in commit `cc06df8` (all 201 files identical to the source). Only `frontend/.env` had been tracked by mistake; it is now untracked.
- [x] Root `.gitignore` (node_modules, dist, coverage, .env, .vscode except extensions.json).
- [x] `npm install`, `npm run build`, and `npx vitest run` pass as in the source (expect API-dependent tests; note the baseline).
  - Note: the baseline is 45 files / 363 tests, all green (the tests mock axios, so none need the API). Three heavy form tests timed out at the default 5 s with `--maxWorkers=4`, so `testTimeout` is now 15 s in `vite.config.js`. Lint: 0 warnings, 0 errors.
- [x] Root `README.md`: what the demo is, how to run it, how to deploy it.
- **Done when:** the app builds, and the first commit is made on `main`.
- Note: no new tests for D-01; nothing new to test, so the existing suite is the check.

### D-02 Fake DB layer
- [x] `src/demo/db.js`: `load()`, `save()`, `reset()`, `nextId(table)`, simple `find/where/insert/update/remove` helpers, in-memory fallback.
- [x] `src/demo/seed.js`: deterministic seed relative to today (section 5).
- [x] Unit tests: seed is deterministic, reset works, blocked storage does not crash.
- Note: the DB stores date-times as Cairo wall-clock strings (like MySQL in the source); `src/demo/clock.js` converts them to ISO with the Cairo offset. Rows are saved once per write request by the router, not by each helper. Besides the source's DemoSeeder data, the seed has today's evening bookings (or seen visits for slots already past) and 4 prescriptions instead of 2. Patient #1 never gets an upcoming booking, so the demo patient can book at once. The seed builds the same rows for the same moment (the PRNG is mulberry32, not PHP's mt_rand, so the rows differ from the source).

### D-03 Fake router and axios adapter
- [x] `src/demo/router.js`: `(method, url, params, body, headers) → { status, data, headers }` with path params, plus a helper to throw axios-style errors (`error.response.status/data`), so the existing error handling works unchanged.
- [x] `src/demo/adapter.js`: axios custom adapter with the fake delay; supports `responseType: 'blob'`.
- [x] `client.js`: use the adapter when `import.meta.env.VITE_DEMO !== 'false'` (demo on by default). Keep the token, 401 and `Accept-Language` logic.
- [x] Auth handlers: login, register, logout, `/me`; tokens are fake strings mapped to user ids in the DB.
- [x] `/health`.
- **Done when:** login as each role works and `/me` returns the right user.

### D-04 Doctor: patients, history, visits, payments
- [ ] Routes and rules from section 3/4 (PaymentService). Tests for remaining balance in piastres.

### D-05 Slots, booking and schedules (all roles)
- [ ] `/slots`, doctor and assistant appointments, status changes, blocked times, working hours, patient booking and cancel. Tests: 409 on a taken slot, Cairo dates, no past slots.

### D-06 Prescriptions and drugs
- [ ] Routes and PrescriptionService rules; drug search.

### D-07 Reports, settings, staff, audit logs
- [ ] ReportService by visit date; settings; staff CRUD; audit log entries written by the other handlers. Tests for summary and daily revenue.

### D-08 Assistant and patient areas
- [ ] Remaining assistant and patient routes; role checks (403) on every route, with a table-driven test like the source's permissions test.

### D-09 Role buttons and demo bar
- [ ] Login page: three big buttons **Enter as Doctor / Patient / Assistant** (ar + en text; add keys to **both** `ar.json` and `en.json`, which must have identical keys) that log in instantly and go to that role's home page. Normal login and register still work.
- [ ] A slim **Demo** bar on every logged-in page: current role, **Switch role** (Doctor / Patient / Assistant), **Reset demo data** (with a confirm step). Works in RTL, at 360 px, and passes `npm run check:contrast`.
- [ ] A small note on the login page: "Demo, data is saved only in this browser."

### D-10 Visit export and other browser-only bits
- [ ] Visit export `pdf` → print view; `docx` hidden or a "not in demo" toast (section 2).
- [ ] Remove or neutralize anything that still needs a server (check `warmStart`, Status page, CSP/meta tags pointing at an API URL).

### D-11 Tests and quality gate
- [ ] Update existing Vitest tests that mocked axios so they still pass (or run against the fake backend).
- [ ] `npm run lint` (0 warnings), `npx vitest run --maxWorkers=4`, `npm run build` all green.
- [ ] Drop scripts that only make sense with the real API, or adapt them (a11y/mobile audits are optional).

### D-12 Vercel
- [ ] `vercel.json` at the repo root (or in `frontend/`, with the Vercel root set to `frontend`):
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- [ ] README section: Vercel → Import repo → Root Directory `frontend`, Framework Vite, Build `npm run build`, Output `dist`.
- [ ] `npm run build && npm run preview`: deep links (for example `/doctor/patients/5`) work after a refresh.

### D-13 Walkthrough
- [ ] Follow `E:\claude DR SaaS\docs\walkthrough.md` in the demo: patient books → assistant checks in and takes a payment → doctor adds visit, payment and prescription → reports show it → Reset restores the seed. Both languages. Write the result in `docs/walkthrough.md` of this repo.

## 7. Out of scope
- No real security: passwords and tokens are fake and visible in the browser. Say so in the README.
- No syncing between visitors or devices.
- No changes to `E:\claude DR SaaS`.
