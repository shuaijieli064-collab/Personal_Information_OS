-- SIGNAL · V3 Information Ingestion. Does NOT modify V1/V2.
-- V1 already created sources / source_items (draft). Here we extend them and add `information`.

-- sources: Phase-4 lifecycle fields
ALTER TABLE sources ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PAUSED','ERROR','DISABLED'));
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- widen source type to Phase-4 set (V1 check was RSS,GITHUB,WEB,IMPORT,EMAIL)
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check
    CHECK (type IN ('RSS','GITHUB','URL','FILE'));

-- information: normalized, deduped content (1 source_item -> 0..1 information)
CREATE TABLE IF NOT EXISTS information (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id       uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    source_item_id  uuid NOT NULL UNIQUE REFERENCES source_items(id) ON DELETE CASCADE,
    type            text NOT NULL DEFAULT 'ARTICLE'
                    CHECK (type IN ('ARTICLE','RELEASE','ISSUE','PULL_REQUEST','DOCUMENT','VIDEO','OTHER')),
    title           text NOT NULL,
    content         text,           -- cleaned, normalized (AI will read this, not raw)
    excerpt         text,
    url             text,
    author          text,
    published_at    timestamptz,
    content_hash    text NOT NULL,  -- SHA-256; exact dedup only (semantic dedup is Phase 5)
    language        text,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_information_user_time ON information(user_id, published_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_information_source ON information(source_id);
CREATE INDEX IF NOT EXISTS idx_information_hash ON information(content_hash);
