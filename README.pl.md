[English](README.md) · **Polski**

# Tallyo

Osobisty panel do codziennych spraw: **finanse**, **produktywność** (to-do, kalendarz, nawyki, cele), **nauka** i **notatki**. Interfejs w klimacie **gaming / cyberpunk** — pod realne używanie, nie tylko pod mock-up.

**Status:** **v1.0.0 — gotowy MVP.** Kompletna, gotowa do codziennego użytku wersja — finanse, produktywność, nauka i notatki działają od początku do końca. **UI jest po polsku**; szerszy angielski w aplikacji jest planowany. Dokumentacja jest dwujęzyczna tam, gdzie ma to sens.

---

## Dla kogo jest ten projekt?

| Odbiorca | Jak korzystać |
|----------|----------------|
| **Gość / portfolio** | Sklonuj repo, uruchom **tryb demo** (sam frontend, przykładowe dane). Bez PostgreSQL. |
| **Ty (właściciel)** | Pełny stack lokalnie albo **prywatny** deploy z PostgreSQL, szyfrowaniem i własnym `.env`. |

Repozytorium nadaje się na **publiczny GitHub** jako **showcase**. **Produkcyjna** instancja z prawdziwymi finansami = osobne sekrety, opcjonalnie prywatny hosting, checklista w [Bezpieczeństwo (PL)](docs/SECURITY.pl.md).

**Nie commituj** plików `.env`, kluczy API ani `ENCRYPTION_KEY` — w git są tylko szablony `.env.example`.

---

## Funkcje (skrót)

- **Dashboard** — podsumowanie, szybkie statystyki, opcjonalny tygodniowy raport AI (opt-in, domyślnie wyłączony)
- **Finanse** — transakcje, przychody/wydatki, kategorie, koszty cykliczne, wartość netto, analityka, płatność karta/gotówka
- **To-do** — zakładki, priorytety, termin i godzina, skróty języka naturalnego, powiązania z notatkami/wydarzeniami
- **Kalendarz** — wydarzenia, opcjonalny link do zadania
- **Nawyki i cele** — śledzenie, wykresy, nawyki mierzalne
- **Nauka** — sesje, kursy, projekty, książki, certyfikaty, timer w stylu Pomodoro
- **Notatki** — inbox, pomysły, referencje, archiwum, UX pod markdown
- **Globalnie** — wyszukiwanie, szybkie dodawanie, frontend przyjazny PWA

---

## Gdzie zapisywane są dane

| Obszar | Demo (`VITE_DEMO_MODE=true`) | Zalogowany (backend włączony) |
|--------|------------------------------|-------------------------------|
| Finanse, to-do, kalendarz, nawyki, cele | Przykładowe dane demo | **PostgreSQL** przez API Express |
| Notatki, nauka | Seed demo | **PostgreSQL** przez API Express |
| Sesja auth | — (brak logowania) | **httpOnly cookies** (bez JWT w `localStorage`) |

Po `git pull` ze zmianami schematu uruchom **`npx prisma migrate dev`** (lokalnie) lub **`migrate deploy`** (produkcja).

---

## Bezpieczeństwo (skrót)

W kodzie m.in.: bcrypt, sesja w httpOnly cookies + refresh, Helmet, CORS, rate limit, opcjonalne szyfrowanie pól, walidacja wejścia, bezpieczne linki, nagłówki CSP (Vercel).

**Szczegóły i checklista prod:** [PL](docs/SECURITY.pl.md) · [EN](docs/SECURITY.md)

Przy lokalnych prawdziwych danych: **losowy `JWT_SECRET`** i rozważ `ENCRYPTION_ENABLED=true` — patrz `.env.example`.

---

## Dokumentacja

| Temat | Linki |
|-------|--------|
| Uruchomienie (demo vs konto) | [PL](docs/URUCHOMIENIE.md) · [EN](docs/URUCHOMIENIE.en.md) |
| Bezpieczeństwo i deploy | [PL](docs/SECURITY.pl.md) · [EN](docs/SECURITY.md) |

ARCHITECTURE, OpenAPI i pełny przewodnik wdrożenia w chmurze **nie są** jeszcze w pełni utrzymywane w `docs/`.

---

## Jak uruchomić u siebie

### Wymagania

- **Node.js** 18+
- **PostgreSQL** — tylko przy **własnym koncie** (tryb bez demo). Demo = sam frontend.

### 1. Sklonuj i zainstaluj

```bash
git clone https://github.com/<twoj-user>/Tallyo.git
cd Tallyo
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

`npm run dev` z katalogu głównego uruchamia frontend i backend — paczki w **root**, `frontend` i `backend`.

### 2. Zmienne środowiskowe

Skopiuj szablony (bez sekretów w git):

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Windows (PowerShell):

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

| Plik | Kluczowe zmienne |
|------|------------------|
| `frontend/.env` | `VITE_DEMO_MODE`, `VITE_API_PORT` (= `PORT` backendu) |
| `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, opcjonalnie `ENCRYPTION_*`, `AI_*`, `REGISTRATION_ENABLED` |

Pełna lista w `backend/.env.example`. **Nie commituj** uzupełnionych `.env`.

### 3. Wybierz tryb

#### A) Szybki podgląd — **zalecane dla gości z GitHuba**

`frontend/.env`:

```env
VITE_DEMO_MODE=true
```

```bash
cd frontend
npm run dev
```

**http://localhost:5173** — przykładowe dane, bez logowania i backendu.

Więcej: [PL](docs/URUCHOMIENIE.md) · [EN](docs/URUCHOMIENIE.en.md).

#### B) Pełna aplikacja (konto + PostgreSQL)

1. Utwórz bazę PostgreSQL (np. `tallyo`), ustaw `DATABASE_URL` w `backend/.env`.
2. Wygeneruj silny `JWT_SECRET` (min. 32 znaki) — **nie** publiczny przykład z tutoriali.
3. `frontend/.env`: `VITE_DEMO_MODE=false`, `VITE_API_PORT` = `PORT` backendu.
4. Migracje i start:

```bash
cd backend
npx prisma migrate dev
cd ..
npm run dev
```

- **Frontend:** http://localhost:5173  
- **API:** http://localhost:3002 (domyślnie; w dev Vite proxy `/api`)

Pierwsze konto przez rejestrację. Przy jednym użytkowniku ustaw potem `REGISTRATION_ENABLED=false`.

### Port zajęty?

```bash
npm run kill:ports
```

Typowe porty dev (5173, 3002). Inny port — zatrzymaj proces ręcznie.

### Sprawdzenie jakości

```bash
npm run check
```

Lint + build frontendu, build TypeScript backendu. CI robi podobnie przy push/PR (`.github/workflows/security-ci.yml`).

---

## Stack

| Warstwa | Technologie |
|---------|-------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, TanStack Query |
| Backend | Node.js, Express, Prisma, Zod |
| Baza | PostgreSQL |
| Auth | JWT w httpOnly cookies, bcrypt |

Opcjonalny hosting: frontend **Vercel**, backend **Railway** / **Render** — zmienne prod w [SECURITY](docs/SECURITY.pl.md).

---

## Licencja

MIT
