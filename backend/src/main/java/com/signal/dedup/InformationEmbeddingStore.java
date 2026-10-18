package com.signal.dedup;

import com.signal.common.Vectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * pgvector access for same-event detection. Plain SQL, because pgvector has no JPA mapping.
 *
 * <p>Rows live in the tables V7 created for this purpose and that nothing used until now:
 * {@code information_embeddings} (one vector per item), {@code signal_clusters} (one row per
 * event, anchored on the item that first became a signal) and {@code signal_sources} (the
 * later items that corroborate it).
 *
 * <p>User isolation is enforced in SQL ({@code i.user_id = ?}), not by the caller.
 */
@Repository
public class InformationEmbeddingStore {

    private final JdbcTemplate jdbc;

    public InformationEmbeddingStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Upsert — re-analysing an item must not fail on a duplicate key. */
    public void save(UUID informationId, List<Double> embedding, String model) {
        jdbc.update("""
                INSERT INTO information_embeddings (information_id, embedding, model)
                VALUES (?, CAST(? AS vector), ?)
                ON CONFLICT (information_id) DO UPDATE
                   SET embedding = EXCLUDED.embedding, model = EXCLUDED.model
                """,
                informationId, Vectors.literal(embedding), model);
    }

    /**
     * The nearest <em>other</em> item owned by the same user. Empty when the user has no
     * comparable row yet. Cosine distance uses the same operator as the HNSW index.
     */
    public Optional<Match> nearestOther(UUID userId, UUID informationId, List<Double> embedding) {
        String v = Vectors.literal(embedding);
        List<Match> rows = jdbc.query("""
                SELECT e.information_id,
                       1 - (e.embedding <=> CAST(? AS vector)) AS similarity,
                       i.title
                FROM information_embeddings e
                JOIN information i ON i.id = e.information_id
                WHERE i.user_id = ?
                  AND e.information_id <> ?
                  AND e.embedding IS NOT NULL
                ORDER BY e.embedding <=> CAST(? AS vector)
                LIMIT 1
                """,
                (rs, n) -> new Match(rs.getObject("information_id", UUID.class),
                        rs.getDouble("similarity"), rs.getString("title")),
                v, userId, informationId, v);
        return rows.stream().findFirst();
    }

    /**
     * The cluster owned by {@code anchorInformationId}, created on first use. Keying the
     * cluster on the anchor keeps "one event = one cluster" true without a lookup table of
     * its own.
     */
    public UUID clusterFor(UUID userId, UUID anchorInformationId, String title, double confidence) {
        List<UUID> existing = jdbc.query(
                "SELECT id FROM signal_clusters WHERE user_id = ? AND anchor_information_id = ?",
                (rs, n) -> rs.getObject("id", UUID.class), userId, anchorInformationId);
        if (!existing.isEmpty()) return existing.get(0);
        return jdbc.queryForObject("""
                INSERT INTO signal_clusters (user_id, title, anchor_information_id, confidence)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """, UUID.class, userId, title, anchorInformationId, confidence);
    }

    public void link(UUID clusterId, UUID informationId, double similarity) {
        jdbc.update("""
                INSERT INTO signal_sources (cluster_id, information_id, similarity)
                VALUES (?, ?, ?)
                ON CONFLICT (cluster_id, information_id) DO NOTHING
                """, clusterId, informationId, similarity);
    }

    public record Match(UUID informationId, double similarity, String title) {}
}
