-- SIGNAL · V1 initial schema (draft for review)
-- PostgreSQL 16. Run order managed by Flyway/Liquibase later.
-- NOTE: pgvector is intentionally NOT created in Phase 1 (added in Phase 6).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- ──────────────────────────────────────────────────────────
-- Identity & profile
-- ──────────────────────────────────────────────────────────
CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         citext NOT NULL UNIQUE,
    password_hash text   NOT NULL,
    display_name  text   NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

CREATE TABLE user_profiles (
    user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio                  text,
    theme                text NOT NULL DEFAULT 'dark',
    onboarding_completed boolean NOT NULL DEFAULT false,
    preferences          jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE goals (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text NOT NULL,
    status     text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','paused','done','archived')),
    priority   int  NOT NULL DEFAULT 0,
    started_at timestamptz,
    archived_at timestamptz
);
CREATE INDEX idx_goals_user ON goals(user_id, status);

CREATE TABLE interests (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    weight     numeric(3,2) NOT NULL DEFAULT 0.5,
    source     text NOT NULL DEFAULT 'explicit'
               CHECK (source IN ('explicit','derived')),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_interests_user_lower_name ON interests(user_id, lower(name));

-- ──────────────────────────────────────────────────────────
-- Ingestion
-- ──────────────────────────────────────────────────────────
CREATE TABLE sources (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                text NOT NULL CHECK (type IN ('RSS','GITHUB','WEB','IMPORT','EMAIL')),
    name                text NOT NULL,
    url                 text,
    config              jsonb NOT NULL DEFAULT '{}',
    active              boolean NOT NULL DEFAULT true,
    refresh_interval_sec int NOT NULL DEFAULT 1800,
    last_fetched_at     timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sources_user_active ON sources(user_id, active);

CREATE TABLE source_items (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id    uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    external_id  text,
    url          text,
    url_hash     text NOT NULL,
    title        text NOT NULL,
    author       text,
    content_text text,
    content_hash text NOT NULL,
    lang         varchar(8),
    published_at timestamptz,
    fetched_at   timestamptz NOT NULL DEFAULT now(),
    raw          jsonb,
    UNIQUE (source_id, url_hash)
);
CREATE INDEX idx_source_items_source ON source_items(source_id, fetched_at DESC);

-- ──────────────────────────────────────────────────────────
-- Signals (dedupe output)
-- ──────────────────────────────────────────────────────────
CREATE TABLE signal_clusters (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    canonical_url  text,
    canonical_title text
    -- embedding vector(1536) — added in Phase 6 with CREATE EXTENSION vector
);

CREATE TABLE signals (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster_id     uuid REFERENCES signal_clusters(id) ON DELETE SET NULL,
    title          text NOT NULL,
    summary        text,
    ai_reason      text,
    primary_url    text,
    signal_score   numeric(5,2) NOT NULL DEFAULT 0,
    score_breakdown jsonb NOT NULL DEFAULT '{}',
    category       text,
    read_time_min  int,
    status         text NOT NULL DEFAULT 'unread'
                   CHECK (status IN ('unread','read','saved','important','archived')),
    published_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_signals_user_status_score ON signals(user_id, status, signal_score DESC);
CREATE INDEX idx_signals_user_created ON signals(user_id, created_at DESC);

CREATE TABLE signal_sources (
    signal_id      uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    source_item_id uuid NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
    PRIMARY KEY (signal_id, source_item_id)
);

CREATE TABLE tags (
    id   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    kind text NOT NULL DEFAULT 'topic'
);

CREATE TABLE signal_tags (
    signal_id uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (signal_id, tag_id)
);

-- ──────────────────────────────────────────────────────────
-- Feedback & action
-- ──────────────────────────────────────────────────────────
CREATE TABLE feedback (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id  uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    vote       text NOT NULL CHECK (vote IN ('useful','not_useful','save','ignore')),
    reason     text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, signal_id, vote)
);

CREATE TABLE tasks (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id  uuid REFERENCES signals(id) ON DELETE SET NULL,
    title      text NOT NULL,
    due_at     timestamptz,
    status     text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done')),
    done_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status, due_at);

-- ──────────────────────────────────────────────────────────
-- Knowledge (Phase 6 — table reserved, no embedding column yet)
-- ──────────────────────────────────────────────────────────
CREATE TABLE knowledge_entries (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id  uuid REFERENCES signals(id) ON DELETE SET NULL,
    title      text NOT NULL,
    body       text,
    concepts   jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_relations (
    id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_entry_id  uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    target_entry_id  uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    relation         text NOT NULL CHECK (relation IN ('related','part_of','learns_from')),
    weight           numeric(3,2) NOT NULL DEFAULT 0.5
);

-- ──────────────────────────────────────────────────────────
-- AI & daily brief
-- ──────────────────────────────────────────────────────────
CREATE TABLE ai_conversations (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role          text NOT NULL CHECK (role IN ('user','assistant','tool')),
    content       jsonb NOT NULL,
    tool_calls    jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON ai_messages(conversation_id, created_at);

CREATE TABLE daily_briefs (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brief_date    date NOT NULL,
    stats         jsonb NOT NULL DEFAULT '{}',
    top_signals   jsonb NOT NULL DEFAULT '[]',
    summary       text,
    generated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, brief_date)
);

-- ──────────────────────────────────────────────────────────
-- Connected accounts & audit
-- ──────────────────────────────────────────────────────────
CREATE TABLE connected_accounts (
    id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         text NOT NULL,
    provider_user_id text,
    credentials_ref  text NOT NULL,  -- encrypted reference; never store raw tokens
    scopes           text[] NOT NULL DEFAULT '{}',
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    action     text NOT NULL,
    entity     text,
    meta       jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
