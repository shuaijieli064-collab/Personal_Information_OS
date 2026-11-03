# SIGNAL

**Personal Information OS** — an AI-native personal information operating system.

> Information is infinite. Attention is not.

SIGNAL connects your scattered information sources, understands your goals and interests,
and compresses the information flood into a small number of high-value **Signals** — then
turns them into **Action**.

```
Information → Collect → Normalize → Understand → Deduplicate
            → Personalize → Rank → Signal → Decision → Action → Feedback
```

## Status

**Phases 1–5 complete and frozen · P0 Hardening ✅ · Phase 5.5 ✅ · Phase 6 Knowledge ✅ · Phase 7 Agent ✅ · Phase 8 Automation ✅ — all frozen 2026-10-16.**

| Area | State |
|---|---|
| Backend | Spring Boot 4.1.1 + Java 21 · Auth (JWT + refresh rotation + **credential-endpoint rate limiting**, 429 + `Retry-After`) · Profile/Goals/Interests/Skills · Ingestion (RSS/GitHub/URL/File) · Exact + semantic dedup · Understanding (classify/summary/topics/entities) · Relevance · Signal Score/Generation · Today · Feedback · Knowledge chunking/embedding/**hybrid** retrieval (vector + keyword, RRF-fused, `mode=HYBRID/VECTOR/KEYWORD`) + **cross-encoder rerank** /RAG + Context Builder (K1–K4) · **Agent** (tool registry + permission gate + planner/executor + audit + confirm/reject) · **Automation** (scheduler, source sync, daily brief, notifications, feedback loop, retry/dead-letter) · Flyway V1–V24 |
| Frontend | Next.js 16 + React 19 + Tailwind v4 + Framer Motion 14 · TanStack Query · route groups `(app)`/`(auth)` · AuthGuard + single-flight 401 refresh · AppShell · 19 routes · **Knowledge console** (`/knowledge`) · **Agent console** (`/ai`: goal → step timeline → confirmation panel → tool catalogue) · **Automation console** (`/automation`: brief, jobs, run history + retry, notification inbox) · Vitest (90 tests) |
| Database | PostgreSQL + pgvector (Docker `pgvector/pgvector:pg16`); migrations live **only** in `backend/src/main/resources/db/migration/` (V1–V24, empty-DB rebuild + `ddl-auto=validate` verified) |
| AI | `AIProvider`/`EmbeddingProvider`/`RerankProvider` abstractions · `OpenAICompatibleProvider` (key from env) mutually exclusive with `MockAIProvider` · chat, embeddings and rerank may use **different** providers (`ai.*` / `ai.embedding-*` / `ai.rerank-*`); rerank falls back to `NoopRerankProvider` when unconfigured · 1024-dim embeddings · PromptBoundary (SYSTEM / UNTRUSTED_CONTENT / QUESTION channels) |
| Tests | Backend **363 tests** green · Frontend lint/tsc/Vitest (**90 tests**)/build green |
| Verified live | Real LLM understanding + 1024-dim embeddings (Alibaba DashScope) + `POST /knowledge/search` (**HYBRID** vector+keyword RRF; lexical matches survive a semantic floor; **rerank** reorders, relevance scores + `rerankModel` echoed) + `POST /knowledge/ask` (RAG with `[n]` citations, rerank inherited, declines instead of hallucinating, injection-resistant) + the **Knowledge console** driven in a real browser (search with rerank on/off, grounded answer with clickable citation chips, reindex, 390/768 responsive), end-to-end |
| Not verified | Browser E2E at every breakpoint (desktop + 390 + 768 captured) · production-mode browser pass (production build itself is green and served both locales with HTTP 200) |

Main line complete: Phase 6 → 7 → 8 all frozen 2026-10-16. Candidate next steps (distributed scheduling, cron/NL scheduling, push channels, agent dependency graphs, `/api/v1/discover`) are listed under *Future (Phase 9+)* in [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository Layout

```
SIGNAL/
├── docs/          # Architecture, API, DB, Design, Roadmap, QA reports
├── frontend/      # Next.js App Router app ([locale] routing, zh-CN/en)
├── backend/       # Spring Boot modular monolith + Flyway migrations (sole authority)
├── docker-compose.yml
└── .env.example   # all runtime configuration keys
```

## Documentation Map

| Doc | Purpose |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase status, hardening queue, next steps |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Product & technical architecture, pipeline |
| [docs/API.md](docs/API.md) | REST API contract (v1) |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, entities, migration authority |
| [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md) | Provider abstraction, prompt boundary |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Design tokens + motion system |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Local/容器启动与环境变量 |
| [docs/STARTUP_AND_USER_MANUAL.md](docs/STARTUP_AND_USER_MANUAL.md) | **从零启动全流程 + 每页面使用手册 + 故障排查** |

## Development

```bash
docker compose up -d          # PostgreSQL 16 + pgvector, Redis 7
cd backend && ./mvnw spring-boot:run   # reads backend/.env (gitignored)
cd frontend && npm run dev    # http://localhost:3000
```

Configuration comes from environment / `backend/.env` (see `.env.example`). API keys never enter code or the frontend.

## Core Principles

- Every feature must answer: *does it reduce noise, surface something important, or drive action?*
- Output is minimal. The user should never have to read 126 items.
- Motion serves information, not decoration.
- External web content is **untrusted data**, never agent instructions.
- "Done" requires code + tests + runtime evidence — never "the code looks right".
