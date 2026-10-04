# SIGNAL — Database Design

PostgreSQL 16. Naming: snake_case, plural tables, `timestamptz` everywhere, UUID primary keys.
`pgvector` extension is **not** enabled in Phase 1 — it lands with Knowledge/RAG (Phase 6).

## Entity overview

```
users 1─1 user_profiles
users 1─n goals / interests / sources / signals / tasks / knowledge_entries / feedback
sources 1─n source_items
signals n─n source_items        (via signal_sources — dedupe clusters)
signals n─n tags                (via signal_tags)
signals 1─n feedback / tasks
knowledge_entries n─n itself    (via knowledge_relations)
users 1─n ai_conversations 1─n ai_messages
users 1─n daily_briefs
users 1─n connected_accounts
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

**signal_clusters** — the dedupe result. Several source_items collapse into one Signal.
- `id uuid PK, user_id FK, canonical_url text, canonical_title text, embedding vector(1536) NULL` *(column added in Phase 6)*

**signals**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | row isolation |
| cluster_id | uuid FK → signal_clusters | nullable |
| title | text | canonical title |
| summary | text | 2–3 sentences, AI-generated |
| ai_reason | text | "Why this matters" |
| primary_url | text | best source link |
| signal_score | numeric(5,2) | 0–100 |
| score_breakdown | jsonb | per-factor scores |
| category | text | tech/career/campus/research/… |
| read_time_min | int | |
| status | text | unread/read/saved/important/archived |
| published_at, created_at, updated_at | timestamptz | |

INDEX `(user_id, status, signal_score DESC)`, `(user_id, created_at DESC)`

**signal_sources** — join: which raw items this Signal covers → "Covered by 5 sources"
- `signal_id uuid FK, source_item_id uuid FK, PK(signal_id, source_item_id)`

**tags** — `id uuid PK, name text UNIQUE, kind text(topic/entity)`
**signal_tags** — `signal_id, tag_id, PK(both)`

### Feedback & personalization

**feedback** — `id uuid PK, user_id FK, signal_id FK, vote text(useful/not_useful/save/ignore), reason text, created_at`
- UNIQUE `(user_id, signal_id, vote)`

**tasks** — Action layer
- `id uuid PK, user_id FK, signal_id FK NULL, title text, due_at timestamptz NULL, status text(todo/done), done_at timestamptz, created_at`

### Knowledge (Phase 6)

**knowledge_entries** — `id uuid PK, user_id FK, signal_id FK NULL, title text, body text, concepts jsonb, embedding vector NULL, created_at`
**knowledge_relations** — `id uuid PK, source_entry_id FK, target_entry_id FK, relation text(related/part-of/learns-from), weight numeric(3,2)`

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
