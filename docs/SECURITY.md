**English** · [Polski](https://github.com/kamil0006/Tallyo/blob/main/docs/SECURITY.pl.md)

# Tallyo — Security

Security guide for the **private (production)** and **public (showcase/demo)** versions.

## Version split

| Aspect | Showcase (GitHub) | Private production |
|--------|-------------------|---------------------|
| Data | Demo / seed | Real user data |
| `ENCRYPTION_ENABLED` | `false` | **`true`** |
| `REGISTRATION_ENABLED` | `true` (optional) | **`false`** |
| OpenAI | **`false`** | Opt-in only |
| JWT / session | Strong secret in `.env` | Strong secret + httpOnly cookies |

## Production deployment checklist

### Backend (`.env`)

```env
NODE_ENV=production
JWT_SECRET=<random, min. 32 characters>
FRONTEND_URL=https://your-domain.com
REGISTRATION_ENABLED=false
ALLOW_DEV_RESET=false

ENCRYPTION_ENABLED=true
ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">

AI_REPORT_ENABLED=false
AI_USE_OPENAI=false
```

### After deploy

- [ ] Run `npx prisma migrate deploy` on the production database
- [ ] HTTPS on frontend and backend (required for `Secure` cookies)
- [ ] `FRONTEND_URL` matches the FE domain exactly (CORS)
- [ ] Database backups + **secure storage of `ENCRYPTION_KEY`** (losing the key means losing decrypted fields)
- [ ] Rotating `JWT_SECRET` forces all users to log in again

## Security layers (implemented)

### Authentication

- Passwords: bcrypt cost 12, min. 8 characters, letter + digit
- JWT in **httpOnly cookies** (`tallyo_session` + `tallyo_refresh`)
- Access token: **1 h**; refresh: **7 days** (remember me) or **24 h** (session)
- `POST /api/auth/refresh` — automatic session refresh (frontend)
- Registration and password reset gated by env flags
- Login rate limit: 30 req / 15 min

### Transport and headers

- Helmet (BE)
- CORS allowlist (`FRONTEND_URL`)
- CSP, X-Frame-Options, Referrer-Policy (`frontend/vercel.json`)
- JSON body limit: 512 KB

### Sensitive data

- AES-256-GCM (`ENCRYPTION_ENABLED=true`) for:
  - Notes: content, title, reference source
  - Finance (text): transaction names, income sources, account names, adjustment descriptions
- Financial amounts remain numeric (DB sorting/filtering)

### AI

- Disabled by default
- Requires `AI_REPORT_ENABLED=true` **and** `AI_USE_OPENAI=true` **and** an API key
- Only aggregated, minimized payload is sent to OpenAI (no note content or individual transactions)

### Input validation

- Zod on all API routes
- Text field length limits
- Link ownership: todo ↔ event ↔ note, learning session ↔ course/project/book
- URL sanitization (`http`/`https` only) in notes and learning

### Frontend

- Safe external links (`SafeExternalLink` / `safeHref`)
- Password reset visible only in dev build
- No JWT in `localStorage`

## CI

Workflow `.github/workflows/security-ci.yml`:

- `npm audit --audit-level=high` (root + backend + frontend) — blocking
- Backend and frontend unit tests (Vitest) — blocking
- TypeScript build (BE + FE)

## Reporting vulnerabilities

Private deployment — contact the maintainer directly.
Public repo — open a GitHub issue **without** real data or secrets.

## Known limitations / roadmap

- Financial amounts are not encrypted (deliberate trade-off: SQL queries)
- No refresh token rotation in the database (stateless JWT)
- No 2FA / WebAuthn
- Demo mode uses localStorage — does not apply to API accounts
