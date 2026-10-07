# SIGNAL — Frontend Deployment

## Local development

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Backend must run at `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`).
Override via env or `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Checks

| Command | Purpose |
|---|---|
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npx tsc --noEmit` | TypeScript typecheck |
| `npm test` | Vitest (jsdom) — auth refresh lifecycle, AuthGuard, UI primitives |
| `npm run build` | Production build (includes typecheck + static generation) |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every push/PR.

## Production

### Docker (recommended)

```bash
docker build -t signal-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  frontend/
docker run -p 3000:3000 signal-frontend
```

Multi-stage build (deps → builder → runner). The runner image is the
Next.js **standalone** server (`next.config.ts` sets `output: "standalone"`),
which bundles only what the app needs. `NEXT_PUBLIC_API_URL` is baked at build
time (it is a client-side constant).

### Manual / Vercel

```bash
npm run build
npm run start       # standalone server on :3000
```

On Vercel: set `NEXT_PUBLIC_API_URL` in project environment variables and
import the repo; framework preset (Next.js) is auto-detected.

## Architecture notes

- Tokens live in `localStorage` (`signal.access` / `signal.refresh`); the API
  client refreshes on 401 (single-flight) and broadcasts `signal:unauthorized`
  when the session is unrecoverable — `AuthGuard` then redirects to `/login`.
- Routes are grouped: `(auth)` = login/register, `(app)` = authenticated pages
  behind `AuthGuard` + `AppShell` (top navigation).
- i18n: `next-intl`, locales `zh-CN` (default) and `en`; messages in
  `frontend/messages/*.json`. Do not hardcode user-visible strings.
