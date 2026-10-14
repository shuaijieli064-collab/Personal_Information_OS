package com.signal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Alibaba DashScope (百炼) text re-ranking adapter.
 *
 * <p><b>Why a dedicated class</b>: DashScope's re-ranker is served from its
 * <i>native</i> API ({@code POST /api/v1/services/rerank/text-rerank/text-rerank}),
 * not the OpenAI-compatible {@code /compatible-mode/v1} surface that embeddings use.
 * The request/response shape is therefore vendor-specific — hence a dedicated adapter
 * rather than reuse of {@link OpenAICompatibleEmbeddingProvider}. Verified live
 * 2026-10-14: {@code qwen3.7-text-rerank} returns HTTP 200 with well-separated scores.
 *
 * <p>Active when a re-rank key can be resolved ({@code ai.rerank-api-key}, falling back
 * to {@code ai.embedding-api-key} and then {@code ai.api-key}). Bounded timeout, max 2
 * retries, never logs keys.
 */
@Component
@ConditionalOnExpression("'${ai.rerank-api-key:}' != '' || '${ai.embedding-api-key:}' != '' || '${ai.api-key:}' != ''")
public class DashScopeRerankProvider implements RerankProvider {

    private static final Logger log = LoggerFactory.getLogger(DashScopeRerankProvider.class);

    /** Native DashScope re-rank path, appended to {@code ai.rerank-base-url}. */
    static final String RERANK_PATH = "/services/rerank/text-rerank/text-rerank";

    private final AIProperties props;
    private final HttpClient client;
    private final ObjectMapper json = new ObjectMapper();

    public DashScopeRerankProvider(AIProperties props) {
        this.props = props;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.timeoutMs()))
                .build();
    }

    @Override
    public String model() {
        return props.rerankModel();
    }

    @Override
    public List<RerankHit> rerank(String query, List<String> documents, int topN) {
        if (documents == null || documents.isEmpty()) return List.of();
        int n = Math.max(1, Math.min(topN, documents.size()));

        Map<String, Object> body = Map.of(
                "model", props.rerankModel(),
                "input", Map.of("query", query == null ? "" : query, "documents", documents),
                "parameters", Map.of("return_documents", false, "top_n", n));

        RuntimeException last = null;
        for (int attempt = 0; attempt <= Math.min(props.maxRetries(), 2); attempt++) {
            try {
                HttpRequest http = HttpRequest.newBuilder(URI.create(props.rerankBaseUrl() + RERANK_PATH))
                        .timeout(Duration.ofMillis(props.timeoutMs()))
                        .header("Authorization", "Bearer " + props.rerankApiKey())
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                        .build();
                HttpResponse<byte[]> res = client.send(http, HttpResponse.BodyHandlers.ofByteArray());
                if (res.statusCode() >= 500 || res.statusCode() == 429) {
                    last = new RuntimeException("Rerank HTTP " + res.statusCode());
                    continue; // bounded retry
                }
                if (res.statusCode() >= 400) {
                    throw new OpenAICompatibleProvider.AIException("Rerank request failed: " + res.statusCode());
                }
                return parseRerank(res.body());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                last = new OpenAICompatibleProvider.AIException("Rerank call interrupted");
                break;
            } catch (Exception e) {
                last = (e instanceof RuntimeException re) ? re : new OpenAICompatibleProvider.AIException("Rerank call failed");
            }
        }
        log.warn("Rerank call failed after retries provider={} model={}", props.provider(), props.rerankModel());
        throw new OpenAICompatibleProvider.AIException("Rerank provider unavailable: "
                + (last == null ? "unknown" : last.getMessage()));
    }

    /**
     * Parses {@code {"output":{"results":[{"index":0,"relevance_score":0.88},…]}}} and
     * returns the hits best-first. DashScope already sorts, but the ordering is
     * re-established here so the contract does not depend on the vendor's promise.
     */
    static List<RerankHit> parseRerank(byte[] body) {
        JsonNode root = new ObjectMapper().readTree(body);
        JsonNode arr = root.path("output").path("results");
        if (!arr.isArray() || arr.isEmpty()) {
            throw new OpenAICompatibleProvider.AIException("Rerank response missing output.results");
        }
        List<RerankHit> out = new ArrayList<>(arr.size());
        for (JsonNode r : arr) {
            int index = r.path("index").asInt(-1);
            double score = r.path("relevance_score").asDouble(Double.NaN);
            if (index < 0 || Double.isNaN(score)) {
                throw new OpenAICompatibleProvider.AIException("Rerank response has a malformed result entry");
            }
            out.add(new RerankHit(index, score));
        }
        out.sort((a, b) -> Double.compare(b.score(), a.score()));
        return out;
    }
}
