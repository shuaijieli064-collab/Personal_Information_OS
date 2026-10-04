# SIGNAL — Roadmap, Risks & Next Steps

## First Milestone (this deliverable)

**Scope frozen: Architecture + Design System + Database Design + Project Scaffold + UI Prototype.**
Nothing beyond this is built in Phase 1.

| # | Deliverable | Location | Status |
|---|---|---|---|
| 1 | Product & technical architecture | `docs/ARCHITECTURE.md` | done |
| 2 | PostgreSQL schema (entities + DDL draft) | `docs/DATABASE.md`, `db/migrations/V1__init.sql` | done (draft) |
| 3 | REST API v1 contract | `docs/API.md` | done |
| 4 | Route & page structure | `docs/DESIGN_SYSTEM.md §1` | done |
| 5 | Design tokens (color/type/spacing) | `frontend/design-tokens/tokens.css` | done |
| 6 | Motion system | `docs/DESIGN_SYSTEM.md §6` | done |
| 7 | Project scaffold (frontend/backend/docs tree) | repo root | done |
| 8 | Static UI prototype (visual direction) | `prototype/index.html` | done |

**Explicitly NOT done this phase:** auth implementation, source fetching, AI calls,
real DB running, Next.js/Spring tooling install. Waiting for sign-off.

## Phase 2 status — Foundation tooling (done)

Next.js 16 scaffold + Tailwind v4 + framer-motion · Spring Boot 3 scaffold (Java 21,
Web/Security/JPA/Postgres/Redis/Flyway/Actuator, Maven wrapper) · CORS + stateless
security baseline · Flyway V1 migration in place · docker-compose (PG16+Redis7) ·
`.env.example` · CI workflow · Motion layer (`components/motion/`) · live `/motion-demo`.
Verified: `next build` green (TS clean), `mvnw compile` green.
Local Docker not installed yet → containers unrun on this machine.

## Phases (from spec, re-ordered by dependency)

- **Phase 1** Foundation — ← current
- **Phase 2** Information Engine: RSS collector + parser + normalizer
- **Phase 3** Signal Engine: classify → dedupe → score → rank
- **Phase 4** Today page live + Signal Card + Daily Brief
- **Phase 5** AI Command Center + tool calling
- Phase 6 Knowledge / RAG (pgvector) · Phase 7 Personal Intelligence ·
  Phase 8 More sources · Phase 9 Signal Universe (3D/graph) · Phase 10 Production hardening

Strictly P0 before P1 before P2. No P2/P3 work while P0 is open.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep (spec = 10 phases) | Low delivery velocity, half-built features | Milestone gates; sign-off before each phase; P0 discipline |
| LLM hallucination in summaries/"Why this matters" | Trust erosion | Factual summary templates, score computed by rules first, AI explains only, eval suite (§AI tests) |
| Prompt injection via fetched web content | Agent executes hostile instructions | SYSTEM / USER_DATA / UNTRUSTED_CONTENT separation; external text quoted & sandboxed; tool allow-list |
| LLM cost & latency | Slow UI, runaway spend | Rule-based scoring default; Redis cache for AI responses; async pipeline; model swap via AIProvider |
| Dedupe quality (same event ×5 sources) | Noise returns | 3-stage: URL hash → title sim → embedding cluster (Phase 3); cluster tuning |
| Third-party ToS / private data | Account/legal risk | Only RSS, public APIs, user-imported text; no scraping; SSRF guard; explicit consent per source |
| Cinematic motion hurts low-end devices | Jank, accessibility | reduced-motion support, transform/opacity-only, lazy 3D, device degradation |
| Monorepo tooling sprawl | Setup friction | Next.js + Spring only; MQ/vector DB deferred until volume justifies |

## Next steps (awaiting approval)

1. Tooling scaffold: `create-next-app` in `frontend/` (TS, Tailwind, App Router) +
   Spring Initializr in `backend/` (Web, Security, JPA, Validation).
2. Run PostgreSQL locally / Docker; apply `V1__init.sql`.
3. Task 06: Authentication (register/login/JWT) with tests.
4. Task 12: first RSS source adapter → Postgres.
5. Task 14–15: rule-based Signal Score → wire RSS → DB → static Today.

Stop here until the next instruction.
