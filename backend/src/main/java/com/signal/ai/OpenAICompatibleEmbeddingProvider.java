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
import java.util.List;
import java.util.Map;

/**
 * OpenAI-compatible embeddings adapter ({@code POST /embeddings}).
 * Active when EITHER {@code ai.api-key} or {@code ai.embedding-api-key} is set —
 * mutual exclusion with MockEmbeddingProvider (never @Primary).
 *
 * <p>May target a different provider than chat: base URL, key and model come from the
 * {@code ai.embedding-*} coordinates (which fall back to the chat ones). The requested
 * {@code dimensions} come from {@code ai.embedding-dimensions} and MUST match the
 * {@code vector(…)} schema (V17 = 1024); a mismatch is a hard error.
 * Bounded timeout + max 2 retries. Never logs keys.
 */
@Component
@ConditionalOnExpression("'${ai.api-key:}' != '' || '${ai.embedding-api-key:}' != ''")
public class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAICompatibleEmbeddingProvider.class);

    private final AIProperties props;
    private final HttpClient client;
    private final ObjectMapper json = new ObjectMapper();

    public OpenAICompatibleEmbeddingProvider(AIProperties props) {
        this.props = props;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.timeoutMs()))
                .build();
    }

    @Override public String model() { return props.embeddingModel(); }

    @Override
    public List<Double> embed(String text) {
        int dimensions = props.embeddingDimensions();
        Map<String, Object> body = Map.of(
                "model", props.embeddingModel(),
                "input", text == null ? "" : text,
                "dimensions", dimensions);

        RuntimeException last = null;
        for (int attempt = 0; attempt <= Math.min(props.maxRetries(), 2); attempt++) {
            try {
                HttpRequest http = HttpRequest.newBuilder(URI.create(props.embeddingBaseUrl() + "/embeddings"))
                        .timeout(Duration.ofMillis(props.timeoutMs()))
                        .header("Authorization", "Bearer " + props.embeddingApiKey())
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                        .build();
                HttpResponse<byte[]> res = client.send(http, HttpResponse.BodyHandlers.ofByteArray());
                if (res.statusCode() >= 500 || res.statusCode() == 429) {
                    last = new RuntimeException("Embedding HTTP " + res.statusCode());
                    continue; // bounded retry
                }
                if (res.statusCode() >= 400) {
                    throw new OpenAICompatibleProvider.AIException("Embedding request failed: " + res.statusCode());
                }
                return parseEmbedding(res.body(), dimensions);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                last = new OpenAICompatibleProvider.AIException("Embedding call interrupted");
                break;
            } catch (Exception e) {
                last = (e instanceof RuntimeException re) ? re : new OpenAICompatibleProvider.AIException("Embedding call failed");
            }
        }
        log.warn("Embedding call failed after retries provider={}", props.provider());
        throw new OpenAICompatibleProvider.AIException("Embedding provider unavailable: "
                + (last == null ? "unknown" : last.getMessage()));
    }

    /** Parses {@code {"data":[{"embedding":[...]}]}} and enforces the configured dimension. */
    static List<Double> parseEmbedding(byte[] body, int expectedDimensions) {
        JsonNode root = new ObjectMapper().readTree(body);
        JsonNode arr = root.path("data").path(0).path("embedding");
        if (!arr.isArray() || arr.isEmpty()) {
            throw new OpenAICompatibleProvider.AIException("Embedding response missing data[0].embedding");
        }
        List<Double> out = new java.util.ArrayList<>(arr.size());
        for (JsonNode x : arr) out.add(x.asDouble());
        if (out.size() != expectedDimensions) {
            throw new OpenAICompatibleProvider.AIException(
                    "Embedding dim mismatch: expected " + expectedDimensions + " got " + out.size());
        }
        return out;
    }
}
