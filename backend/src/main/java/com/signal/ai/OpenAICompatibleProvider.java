package com.signal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import tools.jackson.databind.JsonNode;
import java.util.Map;

/**
 * OpenAI-compatible adapter (works for OpenAI / DeepSeek / Qwen-compatible endpoints).
 * Configuration comes ONLY from env. Bounded timeout + max 2 retries. Never logs keys or prompts.
 */
@Component
@ConditionalOnExpression("'${ai.api-key:}' != ''")
public class OpenAICompatibleProvider implements AIProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAICompatibleProvider.class);

    private final AIProperties props;
    private final HttpClient client;
    private final ObjectMapper json = new ObjectMapper();

    public OpenAICompatibleProvider(AIProperties props) {
        this.props = props;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.timeoutMs()))
                .build();
    }

    @Override public String name() { return "openai-compatible:" + props.provider(); }

    @Override
    public String chat(ChatRequest req) {
        return call(req, false);
    }

    @Override
    public String structuredOutput(ChatRequest req) {
        return call(req, true);
    }

    private String call(ChatRequest req, boolean jsonMode) {
        List<Map<String, String>> msgs = req.messages().stream()
                .map(m -> Map.of("role", m.role().name().toLowerCase(), "content", m.content()))
                .toList();
        Map<String, Object> body = new java.util.HashMap<>(Map.of(
                "model", props.model(), "messages", msgs, "temperature", req.temperature()));
        if (jsonMode) body.put("response_format", Map.of("type", "json_object"));

        RuntimeException last = null;
        for (int attempt = 0; attempt <= props.maxRetries(); attempt++) {
            try {
                HttpRequest http = HttpRequest.newBuilder(URI.create(props.baseUrl() + "/chat/completions"))
                        .timeout(Duration.ofMillis(props.timeoutMs()))
                        .header("Authorization", "Bearer " + props.apiKey())
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                        .build();
                HttpResponse<byte[]> res = client.send(http, HttpResponse.BodyHandlers.ofByteArray());
                if (res.statusCode() >= 500 || res.statusCode() == 429) {
                    last = new RuntimeException("AI HTTP " + res.statusCode());
                    continue; // bounded retry
                }
                if (res.statusCode() >= 400) {
                    throw new AIException("AI request failed: " + res.statusCode());
                }
                JsonNode root = json.readTree(res.body());
                return root.path("choices").path(0).path("message").path("content").asText("");
            } catch (Exception e) {
                last = (e instanceof RuntimeException re) ? re : new AIException("AI call failed");
            }
        }
        log.warn("AI call failed after retries provider={}", props.provider());
        throw new AIException("AI provider unavailable");
    }

    public static class AIException extends RuntimeException {
        public AIException(String m) { super(m); }
    }
}
