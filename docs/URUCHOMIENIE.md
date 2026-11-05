[English](URUCHOMIENIE.en.md) · **Polski**

# Tallyo – Jak uruchomić

## Dwa tryby pracy

| Tryb | Dane | Logowanie | Backend |
|------|------|-----------|---------|
| **Testowy (demo)** | Przykładowe, mock | Nie wymagane | Nie potrzebny |
| **Własne konto** | Twoje dane w bazie | Wymagane | Wymagany |

---

## Tryb testowy (dane przykładowe)

Do szybkiego podejrzenia aplikacji bez konfiguracji.

### 1. Ustaw frontend

W pliku `frontend/.env`:

```
VITE_DEMO_MODE=true
```

### 2. Uruchom tylko frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Otwórz w przeglądarce

http://localhost:5173

- Od razu widzisz dashboard z przykładowymi danymi
- Możesz klikać, dodawać, usuwać – zmiany są tylko w pamięci (po odświeżeniu wracają)
- Brak logowania, brak backendu

---

## Tryb własnego konta (Twoje dane)

Do używania aplikacji z własnymi danymi zapisywanymi w bazie.

### 1. Wymagania

- Node.js 18+
- PostgreSQL (uruchomiony lokalnie)

### 2. Konfiguracja backendu

W pliku `backend/.env`:

```
DATABASE_URL="postgresql://UŻYTKOWNIK:HASŁO@localhost:5432/tallyo"
JWT_SECRET="twoj-tajny-klucz"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

- Zamień `UŻYTKOWNIK` i `HASŁO` na dane do PostgreSQL
- Utwórz bazę: `psql -U postgres -c "CREATE DATABASE tallyo;"`

### 3. Migracje bazy

```bash
cd backend
npm install
npx prisma migrate dev --name init
```

### 4. Konfiguracja frontendu

W pliku `frontend/.env`:

```
VITE_DEMO_MODE=false
VITE_API_PORT=3002
```

`VITE_API_PORT` musi być taki sam jak `PORT` w `backend/.env`.

### 5. Uruchom oba serwery

**Terminal 1 – backend:**
```bash
cd backend
npm run dev
```

Powinno pojawić się: `Tallyo API running on http://localhost:3002` i potwierdzenie połączenia z bazą.

**Terminal 2 – frontend:**
```bash
cd frontend
npm run dev
```

### 6. Otwórz aplikację

http://localhost:5173

- Zobaczysz stronę logowania
- Kliknij „Nie mam konta – zarejestruj się”
- Zarejestruj się (email + hasło min. 6 znaków)
- Po zalogowaniu widzisz puste dane – dodaj wydatki, przychody itd.

---

## Szybkie przełączanie trybów

| Chcę… | `frontend/.env` |
|-------|-----------------|
| Demo, bez logowania | `VITE_DEMO_MODE=true` |
| Własne dane, z logowaniem | `VITE_DEMO_MODE=false` |

Po zmianie `.env` zrestartuj frontend (Ctrl+C, potem `npm run dev`).

---

## Port zajęty?

```bash
npm run kill:ports
```

(z głównego folderu projektu)

Zatrzymuje procesy na portach ustawionych w `package.json` (m.in. 3001, 5173, 5174). Jeśli backend działa na innym porcie (np. **3002**), zatrzymaj proces ręcznie lub zmień skrypt.

---

## Różne porty backendu

Jeśli backend ma działać np. na 3002:

1. `backend/.env`: `PORT=3002`
2. `frontend/.env`: `VITE_API_PORT=3002`
3. Zrestartuj oba serwery

---

## Docker (cały stack jedną komendą)

Wymaga Dockera. Z głównego folderu projektu:

```bash
docker compose up -d --build
```

Aplikacja: http://localhost:8080 (PostgreSQL + API + frontend serwowany przez nginx).

- `docker compose down` – zatrzymanie (dane w bazie zostają)
- `docker compose down -v` – zatrzymanie i wyczyszczenie bazy

nginx we frontendzie proxuje `/api/` pod adres ze zmiennej `BACKEND_URL`
(szablon: `frontend/nginx.conf.template`). W docker-compose to `http://backend:3002`;
przy wdrożeniu np. na Railway ustaw prywatny adres backendu
(`http://backend.railway.internal:3002`).
