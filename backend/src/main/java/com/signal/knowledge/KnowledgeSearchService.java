package com.signal.knowledge;

import com.signal.ai.EmbeddingProvider;
import com.signal.ai.RerankProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 6 K3 — retrieval over the caller's own chunk corpus.
 *
 * <p>Three modes:
 * <ul>
 *   <li>{@link Mode#HYBRID} (default) — run both legs and fuse them with
 *       <b>Reciprocal Rank Fusion</b>. RRF needs no score calibration between two
 *       incomparable scales (cosine similarity vs {@code ts_rank_cd}), which is why it is
 *       preferred over weighted score mixing.</li>
 *   <li>{@link Mode#VECTOR} — semantic only (cosine, HNSW).</li>
 *   <li>{@link Mode#KEYWORD} — lexical only (full-text, GIN).</li>
 * </ul>
 *
 * <p><b>Why hybrid:</b> vector search alone loses exact identifiers — a function name,
 * an error code, a version string. The keyword leg restores that recall. It targets
 * space-delimited text (English, code, identifiers); PostgreSQL has no CJK word
 * segmentation, so unsegmented Chinese relies on the vector leg (see V19).
 *
 * <p><b>minScore</b> is a cosine-similarity floor and therefore applies to the
 * <i>vector</i> leg only. Lexical matches are never dropped by a semantic threshold —
 * that is the point of having the keyword leg.
 *
 * <p>The embedding provider is an external dependency: when it is unreachable the
 * caller gets a {@link SearchUnavailableException} (mapped to 502) rather than an
 * empty result, so a search outage is never mistaken for "nothing matched". In
 * {@code KEYWORD} mode no embedding call is made, so this cannot happen.
 *
 * <p><b>Re-ranking</b> is a final precision pass: retrieval legs over-fetch a candidate
 * pool, then a cross-encoder scores query+document together and reorders it. It is
 * optional and degrades gracefully — a re-rank failure (or the no-op provider) keeps
 * the retrieval order and reports {@code reranked=false}; it never fails the request.
 */
@Service
public class KnowledgeSearchService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeSearchService.class);

    static final int DEFAULT_LIMIT = 10;
    static final int MAX_LIMIT = 50;
    /** RRF damping constant — the standard value from the original RRF paper. */
    static final int RRF_K = 60;
    /** Cap the OR-query size so a pasted paragraph cannot explode the tsquery. */
    static final int MAX_TERMS = 12;
    /** Each leg over-fetches so fusion has room to reorder; bounded. */
    static final int LEG_POOL_MIN = 20;
    static final int LEG_POOL_MAX = 100;
    /** Candidate pool handed to the re-ranker — wider than the result limit, still bounded. */
    static final int RERANK_POOL_MIN = 20;
    static final int RERANK_POOL_MAX = 50;

    public enum Mode { HYBRID, VECTOR, KEYWORD }

    private final EmbeddingProvider embeddings;
    private final ChunkStore store;
    private final RerankProvider reranker;
    private final int embeddingDimensions;

    public KnowledgeSearchService(EmbeddingProvider embeddings,
                                  ChunkStore store,
                                  RerankProvider reranker,
                                  @Value("${ai.embedding-dimensions:1024}") int embeddingDimensions) {
        this.embeddings = embeddings;
        this.store = store;
        this.reranker = reranker;
        this.embeddingDimensions = embeddingDimensions;
    }

    /**
     * Search outcome — echoes the effective parameters so the client can reason about
     * the result set. {@code reranked} reports whether the cross-encoder actually ran
     * (false when disabled, when no provider is configured, or when it failed);
     * {@code rerankModel} names the model when it did.
     */
    public record SearchResult(String query, Mode mode, String model, int limit, double minScore,
                               int count, boolean reranked, String rerankModel,
                               List<ScoredChunk> results) {}

    public SearchResult search(UUID userId, String query, Mode mode, Integer limit,
                               Double minScore, Boolean rerank) {
        String q = query == null ? "" : query.trim();
        int effectiveLimit = clampLimit(limit);
        double effectiveMin = clampMinScore(minScore);
        Mode effectiveMode = mode == null ? Mode.HYBRID : mode;
        // Re-rank only when requested AND a real provider exists — the no-op provider
        // reports unavailable, so we skip the call entirely rather than fake an order.
        boolean wantRerank = (rerank == null || rerank) && reranker.available();

        if (q.isEmpty()) {
            // Blank query is not an error — it simply matches nothing.
            return new SearchResult(q, effectiveMode, embeddings.model(), effectiveLimit,
                    effectiveMin, 0, false, null, List.of());
        }

        List<ScoredChunk> vectorHits = List.of();
        if (effectiveMode != Mode.KEYWORD) {
            vectorHits = store.searchByVector(userId, embed(q), legPool(effectiveLimit), effectiveMin);
        }

        List<ScoredChunk> keywordHits = List.of();
        if (effectiveMode != Mode.VECTOR) {
            String tsQuery = toWebsearchQuery(q);
            if (tsQuery != null) {
                keywordHits = store.searchByKeyword(userId, tsQuery, legPool(effectiveLimit));
            }
        }

        // Over-fetch when re-ranking so the cross-encoder has a real choice to make.
        int pool = wantRerank ? rerankPool(effectiveLimit) : effectiveLimit;
        List<ScoredChunk> candidates = switch (effectiveMode) {
            case VECTOR -> first(vectorHits, pool);
            case KEYWORD -> first(keywordHits, pool);
            case HYBRID -> fuse(vectorHits, keywordHits, pool);
        };

        List<ScoredChunk> results = candidates;
        boolean reranked = false;
        String rerankModel = null;
        if (wantRerank && candidates.size() > 1) {
            Reranked rr = applyRerank(q, candidates);
            results = rr.results();
            reranked = rr.applied();
            if (reranked) rerankModel = reranker.model();
        }
        results = first(results, effectiveLimit);

        log.debug("knowledge search user={} mode={} vector={} keyword={} reranked={} returned={} limit={} minScore={}",
                userId, effectiveMode, vectorHits.size(), keywordHits.size(), reranked,
                results.size(), effectiveLimit, effectiveMin);
        return new SearchResult(q, effectiveMode, embeddings.model(), effectiveLimit,
                effectiveMin, results.size(), reranked, rerankModel, results);
    }

    /** Re-ranked result list plus whether the cross-encoder actually applied. */
    private record Reranked(List<ScoredChunk> results, boolean applied) {}

    /**
     * Reorders candidates with the cross-encoder, replacing {@code score} with the
     * relevance score while keeping {@code vectorScore}/{@code keywordScore} as
     * provenance. Never throws: any failure keeps the retrieval order.
     *
     * <p>Defensive: candidates the re-ranker did not return (malformed index, duplicate,
     * or a partial response) are appended in retrieval order rather than dropped — a
     * re-rank must reorder, never silently reduce recall.
     */
    private Reranked applyRerank(String query, List<ScoredChunk> candidates) {
        try {
            List<String> docs = candidates.stream().map(ScoredChunk::content).toList();
            List<RerankProvider.RerankHit> hits = reranker.rerank(query, docs, candidates.size());
            if (hits == null || hits.isEmpty()) return new Reranked(candidates, false);
            List<ScoredChunk> out = new ArrayList<>(candidates.size());
            Set<Integer> ranked = new HashSet<>();
            for (RerankProvider.RerankHit h : hits) {
                int i = h.index();
                if (i < 0 || i >= candidates.size() || !ranked.add(i)) continue;
                out.add(candidates.get(i).withScore(h.score()));
            }
            if (out.isEmpty()) return new Reranked(candidates, false);
            for (int i = 0; i < candidates.size(); i++) {
                if (!ranked.contains(i)) out.add(candidates.get(i));
            }
            return new Reranked(out, true);
        } catch (Exception e) {
            log.warn("Rerank failed, keeping retrieval order: {}", e.toString());
            return new Reranked(candidates, false);
        }
    }

    /** Embeds the query, enforcing the schema dimension. */
    private List<Double> embed(String q) {
        List<Double> vector;
        try {
            vector = embeddings.embed(q);
        } catch (Exception e) {
            // The provider already reports "Embedding provider unavailable: …"; don't prefix again.
            String detail = e.getMessage();
            throw new SearchUnavailableException(
                    detail == null || detail.isBlank() ? "embedding provider call failed" : detail, e);
        }
        if (vector == null || vector.isEmpty()) {
            throw new SearchUnavailableException("Embedding provider returned no vector");
        }
        if (vector.size() != embeddingDimensions) {
            throw new IllegalStateException("Embedding dim " + vector.size()
                    + " != " + embeddingDimensions + " (schema vector(" + embeddingDimensions
                    + ")) — check ai.embedding-dimensions / embedding provider config");
        }
        return vector;
    }

    // ── fusion ─────────────────────────────────────────────────────────────────

    /**
     * Reciprocal Rank Fusion: {@code score(d) = Σ 1 / (RRF_K + rank_leg(d))}, ranks being
     * 1-based. A document found by both legs outranks one found by either alone.
     */
    static List<ScoredChunk> fuse(List<ScoredChunk> vectorHits, List<ScoredChunk> keywordHits, int limit) {
        Map<UUID, ScoredChunk> byChunk = new LinkedHashMap<>();
        Map<UUID, Double> fused = new HashMap<>();
        accumulate(vectorHits, byChunk, fused);
        accumulate(keywordHits, byChunk, fused);

        return fused.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(limit)
                .map(e -> byChunk.get(e.getKey()).withScore(e.getValue()))
                .toList();
    }

    private static void accumulate(List<ScoredChunk> hits,
                                   Map<UUID, ScoredChunk> byChunk, Map<UUID, Double> fused) {
        for (int i = 0; i < hits.size(); i++) {
            ScoredChunk c = hits.get(i);
            byChunk.merge(c.chunkId(), c, KnowledgeSearchService::mergeProvenance);
            fused.merge(c.chunkId(), 1.0 / (RRF_K + i + 1), Double::sum);
        }
    }

    /** Same chunk from both legs: keep one payload but record both provenance scores. */
    private static ScoredChunk mergeProvenance(ScoredChunk old, ScoredChunk added) {
        return new ScoredChunk(old.chunkId(), old.informationId(), old.ordinal(), old.content(),
                old.score(),
                old.vectorScore() != null ? old.vectorScore() : added.vectorScore(),
                old.keywordScore() != null ? old.keywordScore() : added.keywordScore(),
                old.title(), old.url(), old.type(), old.model());
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /**
     * Builds the {@code OR}-joined term string for {@code websearch_to_tsquery}.
     * Letters (including CJK), digits, {@code _ . + -} are kept — they appear in real
     * identifiers ({@code spring_boot}, {@code node.js}, {@code c++}, {@code gpt-4}).
     * Terms shorter than 2 chars are dropped (noise), and the list is capped.
     *
     * <p>Only <i>leading</i> punctuation is stripped: a leading {@code -} would otherwise
     * be parsed by websearch as negation ({@code -foo} → NOT foo), while a trailing dot is
     * harmless because the text parser drops it anyway.
     *
     * @return the query string, or {@code null} when nothing usable remains
     */
    static String toWebsearchQuery(String query) {
        if (query == null) return null;
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        for (String raw : query.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}_.+\\-]+")) {
            String term = raw.replaceAll("^[.\\-+_]+", "");
            if (term.length() < 2) continue;
            terms.add(term);
            if (terms.size() >= MAX_TERMS) break;
        }
        return terms.isEmpty() ? null : String.join(" or ", terms);
    }

    static int legPool(int limit) {
        return Math.min(Math.max(limit * 3, LEG_POOL_MIN), LEG_POOL_MAX);
    }

    /**
     * Candidate pool handed to the re-ranker. Must stay ≤ {@link #legPool} so the legs
     * actually fetch enough rows for the cross-encoder to reorder.
     */
    static int rerankPool(int limit) {
        return Math.min(Math.max(limit, RERANK_POOL_MIN), RERANK_POOL_MAX);
    }

    private static List<ScoredChunk> first(List<ScoredChunk> hits, int limit) {
        return hits.size() <= limit ? hits : new ArrayList<>(hits.subList(0, limit));
    }

    /** Clamp to [1, MAX_LIMIT]; a null or out-of-range value becomes the default / bound. */
    static int clampLimit(Integer limit) {
        if (limit == null) return DEFAULT_LIMIT;
        return Math.max(1, Math.min(limit, MAX_LIMIT));
    }

    /** Clamp to [0, 1] — cosine similarity is bounded by definition. */
    static double clampMinScore(Double minScore) {
        if (minScore == null) return 0.0;
        return Math.max(0.0, Math.min(minScore, 1.0));
    }

    /** The embedding provider could not be reached / returned nothing usable. */
    public static class SearchUnavailableException extends RuntimeException {
        public SearchUnavailableException(String message) { super(message); }
        public SearchUnavailableException(String message, Throwable cause) { super(message, cause); }
    }
}
