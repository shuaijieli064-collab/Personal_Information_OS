# SIGNAL — Database Design

PostgreSQL 16. Naming: snake_case, plural tables, `timestamptz` everywhere, UUID primary keys.
`pgvector` extension is enabled by `V7__semantic_dedup.sql` (`vector` columns, **1024** dims since
V17); semantic search queries land with Knowledge/RAG (Phase 6).

**Migration authority**: `backend/src/main/resources/db/migration/` only (V1–V21).
The legacy root-level `db/migrations/` draft was deleted in P0 Hardening H1 — never
recreate it. An empty database rebuilt through V1–V21 passes Hibernate
`ddl-auto=validate` (V12 aligns migration DDL with the frozen JPA entities;
verified 2026-10-07 for V1–V15, see `docs/RUNTIME_VERIFICATION.md`; V16–V19 added
2026-10-13 and **applied at runtime against the live DB** (Flyway `now at version v19`,
`ddl-auto=validate` green — `RUNTIME_VERIFICATION.md` #31–#33, #57); V20 (agent audit) and
V21 (automation) verified on a **fresh** database — `Successfully applied 21 migrations …
now at version v21` + `Started SignalApplication`, `RUNTIME_VERIFICATION.md` #79–#80) — see
*Known schema drift* below.

> **Note (2026-10-13)**: V7/V10 **redefined** `signal_clusters`/`signal_sources` and
> `signals` relative to their V1 draft. The tables below describe the **current**
> (post-V21) shape, not the V1 draft. Where an entity is not mapped by a JPA class it
> is marked *(SQL-only)*.

## Entity overview

```
users 1─1 user_profiles
users 1─n goals / interests / skills / sources / signals / tasks / knowledge_entries / user_feedback
sources 1─n source_items
information 1─1 source_items    (each Information derives from one raw source_item)
information 1─n information_chunks   (retrieval corpus, V13)
signals n─n source_items        (via signal_sources — V1 shape, see Known drift)
signals n─n tags                (via signal_tags — reserved, unused)
signals 1─n user_feedback / tasks
knowledge_entries n─n itself    (via knowledge_relations)
users 1─n agent_runs 1─n agent_steps   (Phase 7 audit, V20)
users 1─n scheduled_jobs 1─n job_runs  (Phase 8 automation, V21; UNIQUE (user_id, type))
users 1─n notifications                (Phase 8 inbox, V21 — brief + alerts + job failures)
users 1─n ai_conversations 1─n ai_messages   (reserved)
users 1─n daily_briefs                        (reserved — superseded by notifications.type=DAILY_BRIEF)
users 1─n connected_accounts                  (reserved)
```

## Tables

### Identity & profile

**users**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | citext UNIQUE | |
| password_hash | text | bcrypt/argon2 |
| display_name | text | |
| created_at / updated_at / last_login_at | timestamptz | |

**user_profiles** — `user_id uuid PK FK → users`
- `bio text`, `theme text DEFAULT 'dark'`, `onboarding_completed bool DEFAULT false`
- `preferences jsonb DEFAULT '{}'` — digest time, sources density, AI verbosity

**goals** — `id uuid PK, user_id FK, title text, status text(active/paused/done), priority int, started_at, archived_at`

**interests** — `id uuid PK, user_id FK, name text, weight numeric(3,2) DEFAULT 0.5, source text(explicit/derived), updated_at`
- UNIQUE `(user_id, lower(name))`

### Ingestion

**sources** — `id uuid PK, user_id FK, type text(RSS/GITHUB/WEB/IMPORT/EMAIL), name, url text, config jsonb, active bool DEFAULT true, refresh_interval_sec int DEFAULT 1800, last_fetched_at timestamptz, created_at`

**source_items** — one raw fetched item per source
- `id uuid PK, source_id FK, external_id text, url text, url_hash text, title text, author text, content_text text, content_hash text, lang text(8), published_at timestamptz, fetched_at timestamptz, raw jsonb`
- UNIQUE `(source_id, url_hash)` — makes fetching idempotent
- INDEX `(source_id, fetched_at desc)`

### Signals (the deduped output)

**signal_clusters** — *(SQL-only, not mapped by JPA; currently unused — see Known drift)*
- Actual (V1) shape: `id uuid PK, user_id FK, canonical_url text, canonical_title text`
- V7 intended `title / anchor_information_id / confidence / created_at / updated_at`, but its
  `CREATE TABLE IF NOT EXISTS` was a no-op because V1 created the table first.

**signals** (redefined by V10 `DROP TABLE … CASCADE` + `CREATE`)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | row isolation |
| cluster_id | uuid FK → signal_clusters | nullable, **unused** |
| information_id | uuid FK → information | UNIQUE — one Signal per Information |
| title | text | canonical title |
| summary | text | 2–3 sentences |
| why_it_matters | text | "Why this matters" |
| signal_score | double precision | 0–100 (V12 converted from numeric) |
| urgency | text | nullable |
| status | text | `ACTIVE` / `SAVED` / `IMPORTANT` / `ARCHIVED` |
| created_at, updated_at | timestamptz | |

INDEX `(user_id)`, `(user_id, signal_score DESC)`, UNIQUE `(information_id)`

**signal_sources** — *(SQL-only; currently unused — see Known drift)*
- Actual (V1) shape: `signal_id FK → signals, source_item_id FK → source_items, PK(signal_id, source_item_id)`
- V7 intended `(cluster_id, information_id, similarity)`, but its `CREATE TABLE IF NOT EXISTS`
  was a no-op. V10's `DROP TABLE signals CASCADE` also removed the FK on this table.

**information_embeddings** — `information_id uuid PK FK → information, embedding vector(1024), model text, created_at`
**tags** / **signal_tags** — reserved from V1, **not yet written by any code**.

### Feedback & personalization

**user_feedback** (V11) — `id uuid PK, user_id FK, signal_id FK, type text, reason text, created_at, updated_at`
- `type` ∈ `USEFUL` / `NOT_USEFUL` / `SAVE` / `IGNORE` / `IMPORTANT`
- UNIQUE `(user_id, signal_id)` — one feedback row per user+signal (upsert semantics)
- *(V1's `feedback` table with the lowercase `vote` enum is unused legacy; the live table is `user_feedback`.)*

**tasks** — reserved from V1, **no controller yet** (Phase 7).

**tasks** — Action layer
- `id uuid PK, user_id FK, signal_id FK NULL, title text, due_at timestamptz NULL, status text(todo/done), done_at timestamptz, created_at`

### Knowledge (Phase 6)

**information_chunks** (V13) — the retrieval corpus. One row per chunk of an `information`.
- `id uuid PK, user_id FK, information_id FK, ordinal int, content text, char_count int, model text, embedding vector(1024), created_at, updated_at`
- UNIQUE `(information_id, ordinal)`; INDEX `(user_id)`, `(information_id)`, HNSW `(embedding vector_cosine_ops)`, **GIN `to_tsvector('simple', content)` (V19)**
- Written by `ChunkService`/`ChunkStore` (raw SQL — pgvector has no JPA type mapping).
- `embedding` widened `384 → 1024` by **V17**; `ai.embedding-dimensions` must agree.
- Two indexes back the two legs of hybrid retrieval (K3): HNSW = vector leg, GIN tsvector =
  keyword leg. The GIN expression must be written exactly as V19 declares it
  (`to_tsvector('simple', content)`) or the planner will not use the index.
  **CJK caveat**: PostgreSQL has no CJK segmentation, so an unsegmented Chinese sentence is
  a single token — the keyword leg targets space-delimited text (English/code/identifiers)
  and Chinese recall comes from the vector leg.

**knowledge_entries** — `id uuid PK, user_id FK, signal_id FK NULL, title text, body text, concepts jsonb DEFAULT '{}', embedding vector(1024), created_at`
- The `embedding` column is added by **V16** (V14's intended `CREATE TABLE IF NOT EXISTS` was a no-op; see Known drift) and widened to `vector(1024)` by **V17**. No code reads/writes this table yet.

**knowledge_relations** — `id uuid PK, source_entry_id FK, target_entry_id FK, relation text, weight numeric(3,2) NOT NULL DEFAULT 0.5`
- Actual CHECK is V1's `('related','part_of','learns_from')` (underscores), **not** V14's intended hyphens.

### Ingestion status (V15)

**information.status** — `text NOT NULL DEFAULT 'ACTIVE'`, CHECK `('ACTIVE','ARCHIVED')`; INDEX `(user_id, status)`.
Backs the Information archive action (list filter). The column exists and is mapped by the
`Information` entity; the archive **endpoint** is still Phase-6 backlog.

### Agent audit (Phase 7, V20)

**agent_runs** — one row per goal handed to the agent.
- `id uuid PK, user_id FK, goal text, status text, answer text, model text, error text, created_at, updated_at`
- `status` CHECK `('PLANNING','RUNNING','AWAITING_CONFIRMATION','COMPLETED','FAILED','REJECTED')`
- INDEX `(user_id, created_at DESC)`. Mapped by `AgentRun`.

**agent_steps** — the audit trail: one row per planned tool call.
- `id uuid PK, run_id FK (ON DELETE CASCADE), seq int, tool text, permission text, status text, arguments text, result text, rationale text, error text, started_at, finished_at`
- `permission` CHECK `('READ','WRITE','DESTRUCTIVE')`; `status` CHECK `('PLANNED','PENDING_CONFIRMATION','RUNNING','SUCCEEDED','FAILED','SKIPPED','REJECTED')`
- `arguments` / `result` are **JSON text**, not jsonb (this codebase has no jsonb mapping).
- UNIQUE `(run_id, seq)`; INDEX `(run_id, seq)`. Mapped by `AgentStep`.

### Automation (Phase 8, V21)

**scheduled_jobs** — one job per `(user, type)`; the scheduler is driven entirely off this table.
- `id uuid PK, user_id FK (ON DELETE CASCADE), type text, interval_minutes int, enabled boolean, last_run_at, next_run_at, consecutive_failures int, created_at, updated_at`
- `type` CHECK `('SOURCE_SYNC','DAILY_BRIEF','FEEDBACK_LOOP')`; **UNIQUE `(user_id, type)`** — this is what makes
  `POST /automation/jobs` an upsert rather than an insert.
- `next_run_at` is **NOT NULL**; a dead-lettered job (disabled) writes `now()` into it as an inert
  placeholder, because the column has no null state.
- Partial INDEX `idx_scheduled_jobs_due (next_run_at) WHERE enabled` — the tick's hot path.

**job_runs** — the run history behind `consecutive_failures` and the dead-letter queue.
- `id uuid PK, job_id FK (ON DELETE CASCADE), user_id FK, status text, attempt int, detail text, error text, started_at, finished_at, created_at`
- `status` CHECK `('RUNNING','SUCCEEDED','FAILED','DEAD')` — `DEAD` is the dead-letter state.
- INDEX `(job_id, created_at DESC)`, `(status)`.

**notifications** — the single inbox the brief, the important-signal alerts and job failures all feed.
- `id uuid PK, user_id FK (ON DELETE CASCADE), type text, title text, body text, read boolean, payload text, created_at`
- `type` CHECK `('DAILY_BRIEF','IMPORTANT_SIGNAL','JOB_FAILED')`
- `payload` is **JSON text**; for `IMPORTANT_SIGNAL` it holds the signal id and is the **dedupe key** —
  `existsByUserIdAndTypeAndPayload` is an exact match, so a signal is announced at most once with no
  in-memory state.
- INDEX `(user_id, created_at DESC)`, `(user_id, read)`.

## Known schema drift (2026-10-13 review)

Several later migrations re-declared a table that **V1 had already created**, using
`CREATE TABLE IF NOT EXISTS` — which is a **silent no-op**, so the intended redefinition
never applied. Because none of these tables is mapped by a JPA entity, `ddl-auto=validate`
does not catch it and no current code touches them:

| Table | V1 created | Later intent | Actual live shape |
|---|---|---|---|
| `signal_clusters` | ✓ (canonical_url/canonical_title) | V7 (title/anchor/confidence) | **V1 shape** |
| `signal_sources` | ✓ (signal_id/source_item_id) | V7 (cluster_id/information_id) | **V1 shape** |
| `knowledge_entries` | ✓ (no embedding) | V14 (+ embedding) | V1 + **V16** (fixed) |
| `knowledge_relations` | ✓ (part_of/learns_from) | V14 (part-of/learns-from) | **V1 shape** |
| `source_items` | ✓ (all text columns) | — | V1 intent + **V18** (fixed) |

`signals` was redefined correctly (V10 uses `DROP TABLE … CASCADE`). Remediation for the
remaining three is a Phase-6 prerequisite (see `docs/PROJECT_REVIEW.md` §Remediation).

### Schema drift found at runtime (2026-10-13)

**`source_items` text columns (fixed by V18).** This database's `source_items` table carried
`varchar(255)` for `content_text` / `url` / `title` (and `lang` as `varchar(255)` instead of V1's
`varchar(8)`), i.e. the whole table had drifted from V1, which defines them as `text`. Hibernate
schema validation accepts both `text` and `varchar` as VARCHAR, so the drift was silent until
runtime — where it surfaced as:

```
ERROR: value too long for type character varying(255)
```

on **every** import whose body exceeds 255 characters (articles, READMEs, files). `V18` restores
`content_text` / `url` / `title` to `text`; the `SourceItem` entity now declares
`columnDefinition = "text"` for them so a Hibernate-built schema matches. Verified end-to-end
(import → chunk → embed → retrieve, `docs/RUNTIME_VERIFICATION.md`).

**Residual (not yet fixed):** `information.title` / `information.url` / `information.author` and
`source_items.author` / `external_id` remain `varchar(255)`. Same failure mode, lower likelihood
(titles/authors/URLs rarely exceed 255). Widen together with the entity if it is ever hit.

**Embedding dimension (fixed by V17).** V7/V13/V14 froze the `embedding` columns at `vector(384)`
when embeddings were mock-only. The real DashScope embedding model does not offer 384
(supported: 256/512/768/1024/1536/2048/2560), so `V17` widens all three embedding columns to
`vector(1024)` and rebuilds the HNSW indexes.

### AI & briefs

**ai_conversations** — `id uuid PK, user_id FK, title text, created_at`
**ai_messages** — `id uuid PK, conversation_id FK, role text(user/assistant/tool), content jsonb, tool_calls jsonb, created_at`

**daily_briefs** — `id uuid PK, user_id FK, brief_date date, stats jsonb{raw, signals, action}, top_signals jsonb, summary text, generated_at timestamptz, UNIQUE(user_id, brief_date)`

### Account & audit

**connected_accounts** — `id uuid PK, user_id FK, provider text, provider_user_id text, credentials_ref text (encrypted reference, never plaintext), scopes text[], created_at`
**audit_logs** — `id uuid PK, user_id FK NULL, action text, entity text, meta jsonb, created_at`

## Notable constraints

- Every user-scoped table carries `user_id`; service layer enforces it on every query.
- Dedupe lives in `signal_clusters` + `signal_sources` — never delete raw `source_items`.
- Scores are materialized JSON, not computed on read, for Today/Inbox performance.
