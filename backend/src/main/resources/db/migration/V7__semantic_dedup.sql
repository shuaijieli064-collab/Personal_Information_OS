-- SIGNAL · V7 Semantic dedup. Information rows stay immutable; clusters are logical links.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS signal_clusters (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        text,
    anchor_information_id uuid REFERENCES information(id) ON DELETE SET NULL,
    confidence   numeric(4,3),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cluster_user ON signal_clusters(user_id);

CREATE TABLE IF NOT EXISTS signal_sources (
    cluster_id     uuid NOT NULL REFERENCES signal_clusters(id) ON DELETE CASCADE,
    information_id uuid NOT NULL REFERENCES information(id) ON DELETE CASCADE,
    similarity     numeric(4,3),
    PRIMARY KEY (cluster_id, information_id)
);

CREATE TABLE IF NOT EXISTS information_embeddings (
    information_id uuid PRIMARY KEY REFERENCES information(id) ON DELETE CASCADE,
    embedding      vector(384),
    model          text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
