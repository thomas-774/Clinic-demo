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

## Deploy

The site is plain static files (`frontend/dist`) and needs no environment variables. On Vercel: import the repo and set the Root Directory to `frontend`.

## How it works

```
Pages → api/*.js → client.js → axios adapter → src/demo/ fake backend → localStorage
```

Everything demo-specific is in `frontend/src/demo/`. The plan and task list are in [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md).
