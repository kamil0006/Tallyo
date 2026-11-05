**English** · [Polski](README.pl.md)

# Tallyo

Personal dashboard for everyday life: **finances**, **productivity** (to-do, calendar, habits, goals), **learning**, and **notes**. Gaming / cyberpunk UI — built for real daily use, not a static mock-up.

**Status:** **v1.0.0 — ready MVP.** A complete, daily-usable build with finances, productivity, learning, and notes working end-to-end. **UI is Polish-first**; broader English UI is planned. Docs are bilingual where it matters.

---

## Who is this for?

| Audience | How to use it |
|----------|----------------|
| **Visitors / portfolio** | Clone the repo, run **demo mode** (frontend only, sample data). No PostgreSQL required. |
| **You (owner)** | Full stack locally or on a **private** deploy with PostgreSQL, encryption, and your own `.env`. |

This repo is suitable for **public GitHub** as a **showcase**. A **private production** instance with real financial data should use separate secrets, optional private hosting, and the checklist in [Security](docs/SECURITY.md).

**Do not commit** `.env` files, API keys, or `ENCRYPTION_KEY` — only `.env.example` templates are in git.

---

## Features (high level)

- **Dashboard** — overview, quick stats, optional AI weekly report (opt-in, off by default)
- **Finances** — transactions, income/expense, categories, recurring costs, net worth, analytics, card/cash payment method
- **To-do** — tabs, priorities, due date/time, natural-language shortcuts, links to notes/events
- **Calendar** — events, optional link to a to-do
- **Habits & goals** — tracking, charts, measurable habits
- **Learning** — sessions, courses, projects, books, certificates, Pomodoro-style timer
- **Notes** — inbox, ideas, references, archive, markdown-oriented UX
- **Cross-cutting** — global search, quick add, PWA-friendly frontend

---

## Where data lives

| Area | Demo (`VITE_DEMO_MODE=true`) | Logged-in (backend enabled) |
|------|------------------------------|-----------------------------|
| Finances, to-do, calendar, habits, goals | Sample / in-memory demo providers | **PostgreSQL** via Express API |
| Notes, learning | Demo seed data | **PostgreSQL** via Express API |
| Auth session | N/A (no login) | **httpOnly cookies** (not JWT in `localStorage`) |

Run **`npx prisma migrate dev`** (or `migrate deploy` in production) after pulling schema changes.

---

## Security (summary)

Implemented in code: bcrypt passwords, httpOnly session cookies + refresh, Helmet, CORS allowlist, rate limits, field encryption (optional), input validation, safe external links, CSP headers on Vercel.

**Details & production checklist:** [Security (EN)](docs/SECURITY.md) · [Polski](docs/SECURITY.pl.md)

For local development with real data, use a **random `JWT_SECRET`** and consider `ENCRYPTION_ENABLED=true` — see `.env.example`.

---

## Documentation

| Topic | Links |
|-------|--------|
| Getting started (demo vs account) | [EN](docs/URUCHOMIENIE.en.md) · [PL](docs/URUCHOMIENIE.md) |
| Security & deploy checklist | [EN](docs/SECURITY.md) · [PL](docs/SECURITY.pl.md) |

Architecture, OpenAPI, and step-by-step cloud deployment guides are **not** fully maintained in `docs/` yet.

---

## Run locally

### Requirements

- **Node.js** 18+
- **PostgreSQL** — only for **your own account** (non-demo). Demo needs the frontend only.

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/Tallyo.git
cd Tallyo
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

From the repo root, `npm run dev` runs frontend + backend — install dependencies in **root**, `frontend`, and `backend`.

### 2. Environment

Copy templates (no secrets in git):

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Windows (PowerShell):

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

| File | Key variables |
|------|----------------|
| `frontend/.env` | `VITE_DEMO_MODE`, `VITE_API_PORT` (must match backend `PORT`) |
| `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, optional `ENCRYPTION_*`, `AI_*`, `REGISTRATION_ENABLED`, `MAX_USERS` |

See `backend/.env.example` for the full list. **Never commit** filled-in `.env` files.

### 3. Pick a mode

#### A) Quick preview — **recommended for GitHub visitors**

`frontend/.env`:

```env
VITE_DEMO_MODE=true
```

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** — sample data, no login, no backend.

More detail: [Getting started (EN)](docs/URUCHOMIENIE.en.md) · [Uruchomienie (PL)](docs/URUCHOMIENIE.md).

#### B) Full app (your account + PostgreSQL)

1. Create a PostgreSQL database (e.g. `tallyo`), set `DATABASE_URL` in `backend/.env`.
2. Generate a strong `JWT_SECRET` (min. 32 characters) — not a public example from tutorials.
3. `frontend/.env`: `VITE_DEMO_MODE=false`, `VITE_API_PORT` = backend `PORT`.
4. Migrate and start:

```bash
cd backend
npx prisma migrate dev
cd ..
npm run dev
```

- **Frontend:** http://localhost:5173  
- **API:** http://localhost:3002 (default; Vite proxies `/api` in dev)

Register the first account in the app. For a single-user private setup, set `REGISTRATION_ENABLED=false` after that. For a few people, set `REGISTRATION_ENABLED=true` and `MAX_USERS=2` instead — registration closes on its own once 2 accounts exist.

### Busy ports?

```bash
npm run kill:ports
```

Stops common dev ports (5173, 3002). Adjust manually if you use other ports.

### Quality check

```bash
npm run check
```

Frontend lint + build, backend TypeScript build. CI runs a similar check on push/PR (see `.github/workflows/security-ci.yml`).

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, TanStack Query |
| Backend | Node.js, Express, Prisma, Zod |
| Database | PostgreSQL |
| Auth | JWT in httpOnly cookies, bcrypt |

Optional hosting: frontend **Vercel**, backend **Railway** / **Render** — see [Security](docs/SECURITY.md) for production env vars.

---

## License

MIT
