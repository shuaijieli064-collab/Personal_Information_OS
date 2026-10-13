package com.signal.knowledge;

import java.util.UUID;

/**
 * One retrieval hit: a chunk plus its owning Information's citation metadata.
 *
 * @param chunkId       {@code information_chunks.id}
 * @param informationId the Information this chunk belongs to (for the citation link)
 * @param ordinal       chunk position within the Information
 * @param content       chunk text
 * @param score         ranking score — higher is better. In {@code HYBRID} mode this is the
 *                      RRF fusion score (small absolute values, comparable only within one
 *                      result set); in a single-leg mode it is that leg's own score.
 * @param vectorScore   cosine similarity in [0,1], or {@code null} when the vector leg did
 *                      not return this chunk
 * @param keywordScore  PostgreSQL {@code ts_rank_cd}, or {@code null} when the keyword leg
 *                      did not return this chunk
 * @param title         owning Information title (citation)
 * @param url           owning Information url, may be null (citation)
 * @param type          owning Information type (ARTICLE / DOCUMENT / …)
 * @param model         embedding model that produced the stored vector
 */
public record ScoredChunk(
        UUID chunkId,
        UUID informationId,
        int ordinal,
        String content,
        double score,
        Double vectorScore,
        Double keywordScore,
        String title,
        String url,
        String type,
        String model) {

    /** Copy with a different ranking score (used by RRF fusion). */
    ScoredChunk withScore(double newScore) {
        return new ScoredChunk(chunkId, informationId, ordinal, content, newScore,
                vectorScore, keywordScore, title, url, type, model);
    }
}
