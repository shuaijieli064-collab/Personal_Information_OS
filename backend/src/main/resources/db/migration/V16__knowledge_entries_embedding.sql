-- V16: repair a latent Phase-6 K1 defect (found during project review 2026-10-13).
--
-- V1 created `knowledge_entries` (and `knowledge_relations`) with plain
-- `CREATE TABLE`. V14 later re-declared the SAME tables with
-- `CREATE TABLE IF NOT EXISTS` to add `embedding vector(384)` — but because the
-- table already existed, every statement in V14 was a silent no-op on both a
-- fresh database (V1 runs first) and any upgraded database. Result: the intended
-- `embedding` column was never created anywhere.
--
-- This migration closes the gap idempotently so Phase 6 K3/K4 (knowledge
-- retrieval) can persist entry embeddings. The column is nullable and no current
-- code reads or writes `knowledge_entries`, so applying it is backward-compatible
-- and changes no runtime behaviour.
--
-- Deliberately NOT touched here (recorded in docs/DATABASE.md as known drift):
--   * `knowledge_relations.relation` CHECK still uses V1's 'part_of'/'learns_from'
--     (V14's intended 'part-of'/'learns-from' never applied). No code uses it yet.
--   * `knowledge_entries.concepts` DEFAULT remains V1's '{}'.

ALTER TABLE knowledge_entries
    ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding
    ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
