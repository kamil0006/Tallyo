**English** · [Polski](URUCHOMIENIE.md)

# Tallyo — Getting started

## Two modes

| Mode | Data | Login | Backend |
|------|------|-------|---------|
| **Demo (test)** | Sample / mock | Not required | Not required |
| **Your account** | Your data in the DB | Required | Required |

---

## Demo mode (sample data)

For a quick look at the app without extra setup.

### 1. Configure the frontend

In `frontend/.env`:

```
VITE_DEMO_MODE=true
```

### 2. Run the frontend only

```bash
cd frontend
npm install
npm run dev
```

### 3. Open in the browser

http://localhost:5173

- You’ll see the dashboard with sample data right away  
- You can click around, add, remove — changes stay in session memory (refresh resets them)  
- No login, no backend  

---

## Your own account (your data)

For using the app with data stored in PostgreSQL.

### 1. Requirements

- Node.js 18+  
- PostgreSQL (running locally)

### 2. Backend configuration

In `backend/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tallyo"
JWT_SECRET="your-secret-key"
PORT=3002
FRONTEND_URL="http://localhost:5173"
```

- Replace `USER` and `PASSWORD` with your PostgreSQL credentials  
- Create the database: `psql -U postgres -c "CREATE DATABASE tallyo;"`  

### 3. Run migrations

```bash
cd backend
npm install
npx prisma migrate dev --name init
```

### 4. Frontend configuration

In `frontend/.env`:

```
VITE_DEMO_MODE=false
VITE_API_PORT=3002
```

`VITE_API_PORT` must match `PORT` in `backend/.env`.

### 5. Run both servers

**Terminal 1 — backend:**

```bash
cd backend
npm run dev
```

You should see something like: `Tallyo API running on http://localhost:3002` and a successful DB connection message.

**Terminal 2 — frontend:**

```bash
cd frontend
npm run dev
```

### 6. Open the app

http://localhost:5173

- You’ll see the login page  
- Use “Sign up” / register (email + password, min. 6 characters)  
- After login you start with empty data — add expenses, income, etc.  

---

## Switching modes quickly

| Goal | `frontend/.env` |
|------|-----------------|
| Demo, no login | `VITE_DEMO_MODE=true` |
| Your data + login | `VITE_DEMO_MODE=false` |

After changing `.env`, restart the frontend (Ctrl+C, then `npm run dev`).

---

## Port already in use?

```bash
npm run kill:ports
```

(from the project root)

Stops processes on ports configured in `package.json` (e.g. 3001, 5173, 5174). If your backend uses another port (e.g. **3002**), stop that process manually or adjust the script.

---

## Different backend port

If the backend should run on e.g. **3002** (default in `backend/.env.example`):

1. `backend/.env`: `PORT=3002`  
2. `frontend/.env`: `VITE_API_PORT=3002`  
3. Restart both servers  

---

## Docker (full stack with one command)

Requires Docker. From the project root:

```bash
docker compose up -d --build
```

App: http://localhost:8080 (PostgreSQL + API + frontend served by nginx).

- `docker compose down` – stop (database data survives)
- `docker compose down -v` – stop AND wipe the database

The frontend's nginx proxies `/api/` to the address in the `BACKEND_URL` variable
(template: `frontend/nginx.conf.template`). In docker-compose it's `http://backend:3002`;
when deploying e.g. to Railway, set the backend's private address
(`http://backend.railway.internal:3002`).
