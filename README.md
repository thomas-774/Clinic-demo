# Clinic Demo

A static, database-free demo of the Clinic Management System. The real app has a React frontend and a Laravel API. This demo keeps the React frontend unchanged and swaps the network layer for a fake backend in the browser, so all data lives in `localStorage`. Each visitor gets their own copy, seeded with a month of realistic clinic data (dates relative to today), and **Reset demo** brings the seed back.

You can enter as a **Doctor**, a **Patient** or an **Assistant** with one click on the login page.

> **Not secure.** Passwords and tokens are fake and visible in the browser. Do not enter real patient data.

## Run locally

Requires Node 24+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Demo accounts (password `password` for all):

| Role | Phone |
| --- | --- |
| Doctor | `01000000000` |
| Assistant | `01100000000` |
| Patient | `01020000001` |

## Checks

```bash
cd frontend
npm run lint
npx vitest run --maxWorkers=4
npm run build
npm run check:contrast
```

`npm run check` runs all of them plus coverage, the bundle budget and `npm audit`. The app's own tests mock the API as in the source repo (Vitest sets `VITE_DEMO=false`); the fake backend's tests live next to it in `src/demo/` and switch the client to it through `src/test/demo.js`.

The optional browser audits (`npm run a11y:audit`, `npm run mobile:audit`) build with `VITE_DEMO=false` and answer the API from recorded fixtures, as in the source repo.

## Deploy

The site is plain static files (`frontend/dist`) and needs no environment variables.

On Vercel:

1. **Add New → Project → Import** the GitHub repo.
2. **Root Directory:** `frontend`.
3. **Framework Preset:** Vite. **Build Command:** `npm run build`. **Output Directory:** `dist`. (These are also set in `frontend/vercel.json`.)
4. **Deploy.**

`frontend/vercel.json` sends every path to `index.html`, so deep links such as `/doctor/patients/5` work after a refresh, and sends the same security headers (CSP and the rest) as `vite preview`. To check a production build locally:

```bash
cd frontend
npm run build && npm run preview   # http://localhost:4173
```

Setting `VITE_DEMO=false` (with `VITE_API_URL`) builds the normal app against the real API instead.

## How it works

```
Pages → api/*.js → client.js → axios adapter → src/demo/ fake backend → localStorage
```

Everything demo-specific is in `frontend/src/demo/`. The plan and task list are in [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md).
