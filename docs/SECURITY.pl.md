[English](https://github.com/kamil0006/Tallyo/blob/main/docs/SECURITY.md) · **Polski**

# Tallyo — Bezpieczeństwo

Przewodnik bezpieczeństwa dla wersji **prywatnej (production)** i **publicznej (showcase/demo)**.

## Podział wersji

| Aspekt | Showcase (GitHub) | Produkcja prywatna |
|--------|-------------------|---------------------|
| Dane | Demo / seed | Prawdziwe dane użytkownika |
| `ENCRYPTION_ENABLED` | `false` | **`true`** |
| `REGISTRATION_ENABLED` | `true` (opcjonalnie) | **`false`** |
| OpenAI | **`false`** | Tylko świadomy opt-in |
| JWT / sesja | Silny secret w `.env` | Silny secret + httpOnly cookies |

## Checklist wdrożenia produkcyjnego

### Backend (`.env`)

```env
NODE_ENV=production
JWT_SECRET=<losowy, min. 32 znaki>
FRONTEND_URL=https://twoja-domena.pl
REGISTRATION_ENABLED=false
ALLOW_DEV_RESET=false

ENCRYPTION_ENABLED=true
ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">

AI_REPORT_ENABLED=false
AI_USE_OPENAI=false
```

### Po wdrożeniu

- [ ] `npx prisma migrate deploy` na produkcyjnej bazie
- [ ] HTTPS na frontendzie i backendzie (wymagane dla `Secure` cookies)
- [ ] `FRONTEND_URL` dokładnie zgadza się z domeną FE (CORS)
- [ ] Backup bazy + **bezpieczne przechowywanie `ENCRYPTION_KEY`** (utrata klucza = utrata odszyfrowanych pól)
- [ ] Rotacja `JWT_SECRET` wymusza ponowne logowanie wszystkich użytkowników

## Warstwy zabezpieczeń (zaimplementowane)

### Autentykacja

- Hasła: bcrypt cost 12, min. 8 znaków, litera + cyfra
- JWT w **httpOnly cookies** (`tallyo_session` + `tallyo_refresh`)
- Access token: **1 h**; refresh: **7 dni** (zapamiętaj mnie) lub **24 h** (sesja)
- `POST /api/auth/refresh` — automatyczne odświeżanie sesji (frontend)
- Rejestracja i reset hasła gated flagami env
- Rate limit logowania: 30 req / 15 min

### Transport i nagłówki

- Helmet (BE)
- CORS z whitelistą (`FRONTEND_URL`)
- CSP, X-Frame-Options, Referrer-Policy (`frontend/vercel.json`)
- Limit body JSON: 512 KB

### Dane wrażliwe

- AES-256-GCM (`ENCRYPTION_ENABLED=true`) dla:
  - Notatki: treść, tytuł, źródło referencji
  - Finanse (tekst): nazwy transakcji, źródła przychodów, nazwy kont, opisy korekt
- Kwoty finansowe pozostają jako liczby (sortowanie w DB)

### AI

- Domyślnie wyłączone
- Wymaga `AI_REPORT_ENABLED=true` **oraz** `AI_USE_OPENAI=true` **oraz** klucza API
- Do OpenAI trafia tylko zagregowany, zminimalizowany payload (bez treści notatek ani pojedynczych transakcji)

### Walidacja wejścia

- Zod na wszystkich route'ach API
- Limity długości pól tekstowych
- Ownership powiązań: todo ↔ event ↔ note, learning session ↔ course/project/book
- Sanityzacja URL (`http`/`https` only) w notatkach i nauce

### Frontend

- Bezpieczne linki zewnętrzne (`SafeExternalLink` / `safeHref`)
- Reset hasła widoczny tylko w dev buildzie
- Brak JWT w `localStorage`

## CI

Workflow `.github/workflows/security-ci.yml`:

- `npm audit --audit-level=high` (root + backend + frontend) — blokujący
- Testy jednostkowe backendu i frontendu (Vitest) — blokujące
- Build TypeScript (BE + FE)

## Zgłaszanie luk

W wersji prywatnej — kontakt bezpośredni z maintainerem.
W wersji publicznej — issue na GitHubie **bez** załączania prawdziwych danych ani sekretów.

## Znane ograniczenia / roadmap

- Kwoty finansowe nie są szyfrowane (świadomy kompromis: zapytania SQL)
- Brak rotacji refresh tokenów w bazie (JWT stateless)
- Brak 2FA / WebAuthn
- Demo mode używa localStorage — nie dotyczy kont z API
