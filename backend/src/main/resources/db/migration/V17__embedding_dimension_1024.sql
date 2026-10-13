-- V17: widen the embedding dimension 384 -> 1024 to match a real embedding provider.
--
-- Why: the schema was frozen at vector(384) when embeddings were mock-only. The real
-- provider now in use (Alibaba DashScope `qwen3.7-text-embedding-flash`) supports only
-- [256, 512, 768, 1024, 1536, 2048, 2560] — 384 is NOT available. 1024 is the model
-- default and the chosen dimension (ai.embedding-dimensions).
--
-- Existing vectors are deterministic mock/hash placeholders with no semantic value and
-- cannot be cast between dimensions, so the columns are dropped and re-added (all NULL).
-- `POST /api/v1/knowledge/reindex` regenerates them with the real provider.
--
-- Affected tables: information_chunks (V13), information_embeddings (V7),
-- knowledge_entries (V16). HNSW indexes are dropped first and recreated afterwards.

DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_knowledge_entries_embedding;

ALTER TABLE information_chunks     DROP COLUMN IF EXISTS embedding;
ALTER TABLE information_chunks     ADD  COLUMN embedding vector(1024);

ALTER TABLE information_embeddings DROP COLUMN IF EXISTS embedding;
ALTER TABLE information_embeddings ADD  COLUMN embedding vector(1024);

ALTER TABLE knowledge_entries      DROP COLUMN IF EXISTS embedding;
ALTER TABLE knowledge_entries      ADD  COLUMN embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON information_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding
    ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
