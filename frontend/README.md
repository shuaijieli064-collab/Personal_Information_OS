# SIGNAL Frontend

Frontend of **Personal Information OS** — an information OS that compresses
scattered information sources into high-value signals and turns them into
actions.

## Stack

- Next.js 16 (App Router, Turbopack) · React 19
- next-intl 4 — locales `zh-CN` (default) and `en`
- Tailwind CSS v4 · framer-motion 14
- SWR — data fetching (today, sources)
- Vitest + Testing Library — unit tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Backend default base URL is `http://localhost:8080`
(`NEXT_PUBLIC_API_URL`, see `.env.example`).

## Checks

```bash
npm run lint       # ESLint
npx tsc --noEmit   # typecheck
npm test           # Vitest (jsdom)
npm run build      # production build (typecheck + static generation)
```

CI runs all four on every push/PR (`.github/workflows/ci.yml`).

## Structure

- `app/[locale]/` — pages, grouped by `(auth)` (login/register) and
  `(app)` (authenticated pages behind `AuthGuard` + `AppShell`)
- `components/` — `AuthGuard`, `AppShell`, `ui/` primitives, `motion/`
  animations, `motion-demo/` laboratory
- `lib/api/client.ts` — typed API client with single-flight token refresh
  and `signal:unauthorized` broadcast
- `i18n/` — routing + request config; user-visible strings live in
  `messages/*.json`

See `../docs/API.md` for the API contract and `../docs/DEPLOYMENT.md` for
deployment.
