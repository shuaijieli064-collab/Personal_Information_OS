# SIGNAL — Architecture

> Phase 1 design document. This describes the **target** architecture and the decisions
> behind it. Components marked `[deferred]` are intentionally not built yet.

---

## 1. Product Architecture

### 1.1 Core loop

```
                         WORLD
                           │
                           ▼
                     INFORMATION  (GitHub / RSS / Web / Email / Import …)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
     Collect           Understand          Discover
   (sources,         (classify, tag,     (proactive,
    normalize,         summarize,          interest-driven)
    dedupe)            score)
        └──────────────────┼──────────────────┘
                           ▼
                        SIGNAL
                           │
                           ▼
                      DECISION  (Why this matters / Action required)
                           │
                           ▼
                         ACTION  (task, save knowledge, reply, ignore)
                           │
                           ▼
                       FEEDBACK  (👍 / 👎 / save / ignore / search)
                           │
                           ▼
                 PERSONAL INTELLIGENCE  (goals, interests, skills)
                           │
                           └──────►  better signals
```

The product's unit of value is **not a read item** — it is a Signal that changes what the
user does. Every layer above exists to reduce attention cost.

### 1.2 Core user flows

| Flow | Entry | Steps | Exit |
|---|---|---|---|
| **Morning entry** | `Today` | Greeting → stats (126/9/3) → Needs Attention → For You → AI Brief | Action on top item |
| **Triage** | `Inbox` | Filter by source/status → read Signal Card → score/tags → Save / Archive / Feedback | Inbox cleared |
| **Command** | `Ctrl/Cmd+K` | Type question or invoke a quick action | Tool result / focused view |
| **Discovery** | `Discover` | Browse by current path (Java Backend / AI Agent / …) → score match % | Read / Save / Ignore |
| **Knowledge** | `Knowledge` | Saved Signal → AI-extracted concepts → related entries | Knowledge network |
| **Feedback** | Any Signal Card | 👍/👎/Why → preference weight updates | Next ranking changes |

### 1.3 Information → Signal pipeline

```
SOURCE
  │  fetch (scheduled per-source interval; idempotent by content hash)
  ▼
COLLECT        normalize shape per source adapter (RSS / GitHub / Web / Import)
  ▼
CLEAN          strip boilerplate, language detection, charset fix
  ▼
CLASSIFY       category (tech / career / campus / research …), confidence
  ▼
DEDUPE         URL hash → title similarity → embedding cosine → cluster
               5 sources ──► 1 Signal ("Covered by 5 sources")
  ▼
EXTRACT        tags, topics, entities, key facts
  ▼
SUMMARIZE      2–3 sentence factual summary, no hallucinated claims
  ▼
RANK           Signal Score = weighted mix (see §1.4) + personal weights
  ▼
SIGNAL         written to signals table; Today/Inbox derived views
```

Runs as an **offline worker**, never on the request path. The web request only reads
already-computed Signals. `[deferred: RabbitMQ/Kafka]` until volume justifies it —
Phase 1 uses a scheduled task + in-process queue.

### 1.4 Signal Score (0–100)

Initial weights (tunable per-user later):

| Factor | Weight | Source |
|---|---|---|
| Relevance to interests | 25% | embeddings vs interest vectors |
| Goal alignment | 20% | active goals |
| Quality | 15% | source reliability + content heuristics |
| Urgency | 15% | due dates, deadlines, age decay |
| Novelty | 10% | dedupe cluster freshness |
| Personal interest | 10% | feedback history |
| Source reliability | 5% | per-source trust score |

Score is computed by a **rule-based layer first**, AI explanation layered on top —
so the system degrades gracefully when the LLM is unavailable.

---

## 2. Technical Architecture

### 2.1 System overview

```
┌────────────────────────────────────────────────────────────┐
│  Next.js Frontend (App Router, React, TS)                  │
│  Tailwind + shadcn/ui base · Framer Motion · Lenis         │
│  Three.js / React Flow only inside Signal Universe [deferred]│
└───────────────┬────────────────────────────────────────────┘
                │ HTTPS / JSON (REST v1) · JWT
┌───────────────▼────────────────────────────────────────────┐
│  Spring Boot Backend (Java 21)                             │
│  ┌─────────┬──────────┬───────────┬─────────────────────┐  │
│  │ REST    │ Security │ Pipeline  │ AI Gateway          │  │
│  │ Controllers │ (JWT,   │ (scheduled│ (provider-agnostic)│  │
│  │         │  RBAC)   │  collector│                     │  │
│  └─────────┴──────────┴───────────┴─────────────────────┘  │
└───────┬──────────────────┬───────────────────┬────────────┘
        │                  │                   │
┌───────▼───────┐  ┌────────▼────────┐  ┌───────▼─────────┐
│ PostgreSQL 16 │  │ Redis           │  │ MQ [deferred]   │
│ + pgvector    │  │ session/rate    │  │ RabbitMQ later  │
│ (Phase 6)     │  │ limit/cache     │  │                 │
└───────────────┘  └─────────────────┘  └─────────────────┘
        ▲
        │
┌───────┴─────────────────────────────────────────────┐
│ AI Gateway: OpenAI-compatible interface              │
│   OpenAI / DeepSeek / Qwen / Gemini (swap by config) │
│ Business code depends on AIProvider, never on vendor│
└──────────────────────────────────────────────────────┘
```

### 2.2 Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js App Router | SSR for fast first paint, file routing, one deployable |
| Backend | Spring Boot 3 / Java 21 | Spec-mandated; portfolio value; strong JPA/security ecosystem |
| Primary store | PostgreSQL (+ pgvector when RAG arrives) | One operational store; avoids a separate vector DB in Phase 1 |
| Cache | Redis | Sessions, rate limits, hot signals, AI response cache |
| Queue | In-process scheduler now → RabbitMQ later | Show async architecture when pipeline volume exists, not before |
| AI access | `AIProvider` interface with OpenAI-compatible impls | No vendor lock-in; keys in env only |
| Monorepo | Single repo, `frontend/` + `backend/` + `docs/` | Simplest coherent structure for one team |

### 2.3 Backend module layout (target)

```
backend/src/main/java/com/signal/
├── common/          # exceptions, error envelope, page response, utils
├── config/         # web, security, jackson, scheduling
├── security/       # JWT filter, auth entry point, CORS
├── auth/           # register/login/refresh
├── user/           # user, profile, goals, interests
├── source/         # Source entity + adapters: rss/, github/, web/, import/
├── pipeline/       # collect → normalize → dedupe → score (worker)
├── signal/         # Signal read API, feedback, status transitions
├── knowledge/      # save, concepts, relations [Phase 6]
├── ai/             # gateway/, provider/, agent/, tools/
├── task/           # user tasks / action items
└── brief/          # daily brief generation
```

### 2.4 AI & agent architecture

- **One Signal Agent, tool-calling only** in Phase 1 — no multi-agent.
- Tools: `search_information`, `get_signals`, `get_user_profile`, `get_github_updates`,
  `search_knowledge`, `create_task`, `save_knowledge`, `archive_signal`,
  `mark_important`, `generate_daily_brief`.
- **Prompt-injection separation** — three channels in every prompt:
  `SYSTEM` (instructions) / `USER_DATA` (user's own profile) / `UNTRUSTED_CONTENT`
  (fetched web/feed text). Untrusted content is quoted, delimited, and explicitly
  declared as data, never as instructions. "Ignore previous instructions…" inside a
  fetched page must be inert.

### 2.5 Security design (baseline)

- JWT access token (short-lived) + refresh token rotation; HttpOnly secure cookies.
- Per-user row isolation on every query (JPA filter / tenant id).
- Rate limiting at gateway + per-route (Redis sliding window).
- SSRF guard on URL fetching: private IP ranges blocked, allow-list of schemes, size caps.
- Input validation on all boundaries (Bean Validation); XSS via output encoding; CSRF
  protection on cookie auth; parameterized queries only (JPA).
- Connected-account credentials stored as encrypted references, never plaintext.
- No scraping of private/group data; only RSS, public APIs, and user-imported text/files.

### 2.6 Performance budget

- Lighthouse performance > 90 on non-animated routes.
- Route-level code splitting; Three.js / React Flow lazy-loaded only on Signal Universe.
- Virtualized lists for Inbox; images lazy-loaded.
- All AI requests async; UI never blocks on an LLM call (skeleton + staged copy).
