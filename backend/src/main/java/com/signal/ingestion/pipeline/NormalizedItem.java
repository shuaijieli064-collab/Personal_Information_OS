package com.signal.ingestion.pipeline;

import java.time.Instant;
import java.util.Map;

/** Collector output — decoupled from JPA entities. UNTRUSTED_CONTENT throughout. */
public record NormalizedItem(
        String externalId,
        String title,
        String content,      // cleaned plain text
        String excerpt,
        String url,
        String author,
        Instant publishedAt,
        String type,         // ARTICLE / RELEASE / ISSUE / PULL_REQUEST / DOCUMENT / OTHER
        String language,
        Map<String, Object> metadata) {
}
