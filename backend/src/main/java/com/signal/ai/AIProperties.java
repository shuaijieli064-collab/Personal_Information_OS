package com.signal.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI gateway configuration. Chat and embeddings may point at different providers
 * (e.g. chat on ModelScope, embeddings on Alibaba DashScope), so the embedding
 * coordinates default to the chat ones when left blank — a single-provider setup
 * still works with no extra config.
 */
@ConfigurationProperties(prefix = "ai")
public record AIProperties(
        String provider,
        String baseUrl,
        String model,
        String apiKey,
        String embeddingModel,
        String embeddingBaseUrl,
        String embeddingApiKey,
        int embeddingDimensions,
        int timeoutMs,
        int maxRetries) {

    /** Dimension of the `vector(…)` columns — MUST match the DB schema (see V17). */
    public static final int DEFAULT_EMBEDDING_DIMENSIONS = 1024;

    public AIProperties {
        if (embeddingModel == null || embeddingModel.isBlank()) embeddingModel = "text-embedding-3-small";
        if (embeddingBaseUrl == null || embeddingBaseUrl.isBlank()) embeddingBaseUrl = baseUrl;
        if (embeddingApiKey == null || embeddingApiKey.isBlank()) embeddingApiKey = apiKey;
        if (embeddingDimensions <= 0) embeddingDimensions = DEFAULT_EMBEDDING_DIMENSIONS;
        if (timeoutMs <= 0) timeoutMs = 20000;
        if (maxRetries < 0) maxRetries = 0;
        if (maxRetries > 3) maxRetries = 3; // bounded — no infinite retries
    }

    /** True when an embedding call can be made (either key configured). */
    public boolean hasEmbeddingKey() {
        return embeddingApiKey != null && !embeddingApiKey.isBlank();
    }
}
