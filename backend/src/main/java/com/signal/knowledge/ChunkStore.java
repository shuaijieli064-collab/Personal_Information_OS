package com.signal.knowledge;

import com.signal.ingestion.entity.Information;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Chunk persistence via plain SQL — pgvector has no JPA type mapping.
 * Writes are user-scoped by information ownership (user_id mirrored onto the chunk row).
 */
@Repository
public class ChunkStore {

    private final JdbcTemplate jdbc;

    public ChunkStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Idempotent rebuild: wipe the information's chunks, insert the new set. */
    @Transactional
    public void replace(Information info, List<StoredChunk> chunks) {
        jdbc.update("DELETE FROM information_chunks WHERE information_id = ?", info.getId());
        for (StoredChunk c : chunks) {
            if (c.embedding() == null) {
                jdbc.update("""
                        INSERT INTO information_chunks
                          (user_id, information_id, ordinal, content, char_count, model, embedding, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, NULL, now())
                        """,
                        info.getUserId(), info.getId(), c.ordinal(), c.content(),
                        c.content().length(), c.model());
            } else {
                jdbc.update("""
                        INSERT INTO information_chunks
                          (user_id, information_id, ordinal, content, char_count, model, embedding, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?::vector, now())
                        """,
                        info.getUserId(), info.getId(), c.ordinal(), c.content(),
                        c.content().length(), c.model(), vectorLiteral(c.embedding()));
            }
        }
    }

    public long countByUser(java.util.UUID userId) {
        Long n = jdbc.queryForObject(
                "SELECT count(*) FROM information_chunks WHERE user_id = ?", Long.class, userId);
        return n == null ? 0 : n;
    }

    /**
     * K3 semantic retrieval — nearest chunks by cosine distance for one user.
     * Cosine similarity = {@code 1 - (embedding <=> query)}; only rows that actually
     * carry a vector participate (chunks whose embedding failed are keyword-only and
     * are skipped rather than silently ranked as unrelated).
     *
     * <p>User isolation is enforced in SQL ({@code user_id = ?}), not by the caller.
     * The ORDER BY uses the same operator as the HNSW index ({@code vector_cosine_ops}).
     *
     * @param limit   already clamped by the caller
     * @param minScore cosine-similarity floor, in [0, 1]
     */
    public List<ScoredChunk> searchByVector(java.util.UUID userId, List<Double> query,
                                            int limit, double minScore) {
        String vector = vectorLiteral(query);
        return jdbc.query("""
                SELECT c.id, c.information_id, c.ordinal, c.content, c.model,
                       1 - (c.embedding <=> CAST(? AS vector)) AS score,
                       i.title, i.url, i.type
                FROM information_chunks c
                JOIN information i ON i.id = c.information_id
                WHERE c.user_id = ?
                  AND c.embedding IS NOT NULL
                  AND 1 - (c.embedding <=> CAST(? AS vector)) >= ?
                ORDER BY c.embedding <=> CAST(? AS vector)
                LIMIT ?
                """,
                (rs, n) -> {
                    double score = rs.getDouble("score");
                    return new ScoredChunk(
                            rs.getObject("id", java.util.UUID.class),
                            rs.getObject("information_id", java.util.UUID.class),
                            rs.getInt("ordinal"),
                            rs.getString("content"),
                            score, score, null,
                            rs.getString("title"),
                            rs.getString("url"),
                            rs.getString("type"),
                            rs.getString("model"));
                },
                vector, userId, vector, minScore, vector, limit);
    }

    /**
     * Lexical leg of hybrid retrieval — full-text matches ranked by {@code ts_rank_cd}.
     *
     * <p>{@code websearchQuery} is a pre-sanitised {@code OR}-joined term string built by
     * the caller (see {@link KnowledgeSearchService#toWebsearchQuery}); it is fed to
     * {@code websearch_to_tsquery}, which is deliberately forgiving and never raises on
     * odd input. The expression matches {@code idx_chunks_content_fts} (V19) exactly.
     */
    public List<ScoredChunk> searchByKeyword(java.util.UUID userId, String websearchQuery, int limit) {
        return jdbc.query("""
                SELECT c.id, c.information_id, c.ordinal, c.content, c.model,
                       ts_rank_cd(to_tsvector('simple', c.content),
                                  websearch_to_tsquery('simple', ?)) AS kscore,
                       i.title, i.url, i.type
                FROM information_chunks c
                JOIN information i ON i.id = c.information_id
                WHERE c.user_id = ?
                  AND to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', ?)
                ORDER BY kscore DESC
                LIMIT ?
                """,
                (rs, n) -> {
                    double kscore = rs.getDouble("kscore");
                    return new ScoredChunk(
                            rs.getObject("id", java.util.UUID.class),
                            rs.getObject("information_id", java.util.UUID.class),
                            rs.getInt("ordinal"),
                            rs.getString("content"),
                            kscore, null, kscore,
                            rs.getString("title"),
                            rs.getString("url"),
                            rs.getString("type"),
                            rs.getString("model"));
                },
                websearchQuery, userId, websearchQuery, limit);
    }

    static String vectorLiteral(List<Double> v) {
        return com.signal.common.Vectors.literal(v);
    }
}
