package com.signal.ai;

import java.util.List;

/**
 * Vendor-agnostic cross-encoder re-ranking.
 *
 * <p>Retrieval (vector / keyword) is built for <i>recall</i>: it must not miss a
 * relevant document, so it returns a generous candidate list ordered by cheap,
 * independent scores. Re-ranking is the precision pass — a cross-encoder reads the
 * query and each document <b>together</b>, which is far more accurate but too
 * expensive to run over the whole corpus. So it is applied only to the top candidates.
 *
 * <p>This is an <b>optional enhancement</b>: when no provider is configured the
 * no-op implementation is used and retrieval order is returned unchanged (see
 * {@link #available()}).
 */
public interface RerankProvider {

    /** One document's relevance to the query; {@code index} points into the input list. */
    record RerankHit(int index, double score) {}

    /**
     * Scores each document against the query and returns the best {@code topN},
     * highest relevance first.
     *
     * @param documents candidate texts, in retrieval order
     * @param topN      maximum number of hits to return (already clamped by the caller)
     * @throws RuntimeException when the provider cannot be reached — callers treat this
     *                          as "keep the original order", never as a hard failure
     */
    List<RerankHit> rerank(String query, List<String> documents, int topN);

    String model();

    /** {@code false} for the no-op stand-in — callers then skip re-ranking entirely. */
    default boolean available() {
        return true;
    }
}
