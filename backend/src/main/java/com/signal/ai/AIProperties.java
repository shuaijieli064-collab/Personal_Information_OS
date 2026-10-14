package com.signal.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI gateway configuration. Chat, embeddings and re-ranking may point at different
 * providers (e.g. chat on ModelScope, embeddings + re-ranking on Alibaba DashScope), so
 * the embedding coordinates default to the chat ones and the re-rank coordinates default
 * to the embedding ones when left blank — a single-provider setup still works with no
 * extra config.
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
        String rerankModel,
        String rerankBaseUrl,
        String rerankApiKey,
        int timeoutMs,
        int maxRetries) {

    /** Dimension of the `vector(…)` columns — MUST match the DB schema (see V17). */
    public static final int DEFAULT_EMBEDDING_DIMENSIONS = 1024;

    /** Cross-encoder re-ranker model (DashScope native rerank surface). */
    public static final String DEFAULT_RERANK_MODEL = "qwen3.7-text-rerank";

    public AIProperties {
        if (embeddingModel == null || embeddingModel.isBlank()) embeddingModel = "text-embedding-3-small";
        if (embeddingBaseUrl == null || embeddingBaseUrl.isBlank()) embeddingBaseUrl = baseUrl;
        if (embeddingApiKey == null || embeddingApiKey.isBlank()) embeddingApiKey = apiKey;
        if (embeddingDimensions <= 0) embeddingDimensions = DEFAULT_EMBEDDING_DIMENSIONS;
        if (rerankModel == null || rerankModel.isBlank()) rerankModel = DEFAULT_RERANK_MODEL;
        // Re-rank defaults to the embedding provider: both are served by the same
        // DashScope account here. NB the *path* differs (native vs compatible-mode),
        // so ai.rerank-base-url is set explicitly in .env rather than inherited blindly.
        if (rerankBaseUrl == null || rerankBaseUrl.isBlank()) rerankBaseUrl = embeddingBaseUrl;
        if (rerankApiKey == null || rerankApiKey.isBlank()) rerankApiKey = embeddingApiKey;
        if (timeoutMs <= 0) timeoutMs = 20000;
        if (maxRetries < 0) maxRetries = 0;
        if (maxRetries > 3) maxRetries = 3; // bounded — no infinite retries
    }

    /** True when an embedding call can be made (either key configured). */
    public boolean hasEmbeddingKey() {
        return embeddingApiKey != null && !embeddingApiKey.isBlank();
    }

    /** True when a re-rank call can be made (either re-rank key resolved). */
    public boolean hasRerankKey() {
        return rerankApiKey != null && !rerankApiKey.isBlank();
    }
}
