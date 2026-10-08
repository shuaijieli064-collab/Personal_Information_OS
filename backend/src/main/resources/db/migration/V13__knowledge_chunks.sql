-- Phase 6 K1: retrieval corpus. One row per chunk of an Information; pgvector HNSW for semantic search.
-- embedding is vector(384) — matches EmbeddingProvider contract (mock and real providers both emit 384 dims).

CREATE TABLE IF NOT EXISTS information_chunks (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    information_id uuid NOT NULL REFERENCES information(id) ON DELETE CASCADE,
    ordinal        int  NOT NULL,
    content        text NOT NULL,
    char_count     int  NOT NULL,
    model          text,
    embedding      vector(384),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (information_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_chunks_user        ON information_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_information ON information_chunks(information_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding   ON information_chunks USING hnsw (embedding vector_cosine_ops);
