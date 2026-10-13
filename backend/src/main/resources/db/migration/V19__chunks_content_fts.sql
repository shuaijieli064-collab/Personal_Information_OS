-- V19: lexical index for hybrid retrieval (Phase 6 K3+).
--
-- Why: vector search alone misses exact identifiers — function names, error codes,
-- product/version strings. Hybrid retrieval adds a keyword leg; this is its index.
--
-- The expression must be written exactly as the query writes it
-- (`to_tsvector('simple', content)`) so the planner can use the index. 'simple' is
-- deliberate: no stemming (so "autoscaler"/"autoscaling" stay distinct tokens) and
-- no language dictionary, which keeps behaviour predictable for mixed-language corpora.
--
-- CJK caveat: PostgreSQL has no CJK word segmentation, so an unsegmented Chinese
-- sentence becomes a single token and this leg will not match sub-phrases. Chinese
-- recall is served by the vector leg; the keyword leg targets space-delimited text
-- (English, code, identifiers). See docs/DATABASE.md.

CREATE INDEX IF NOT EXISTS idx_chunks_content_fts
    ON information_chunks USING gin (to_tsvector('simple', content));
