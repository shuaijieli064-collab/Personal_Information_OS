package com.signal.understanding.provider;

import com.signal.ai.AIProvider;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit tests for the LLM-backed understanding provider: JSON mapping,
 * taxonomy validation, prompt-boundary discipline and graceful degradation.
 * No Spring context, no network.
 */
class RealUnderstandingProviderTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Canned provider: returns a fixed string, or throws when told to. */
    private static AIProvider providerReturning(String raw) {
        return new AIProvider() {
            @Override public String chat(ChatRequest r) { return raw; }
            @Override public String structuredOutput(ChatRequest r) { return raw; }
            @Override public String name() { return "fake:test"; }
        };
    }

    private static AIProvider providerThrowing() {
        return new AIProvider() {
            @Override public String chat(ChatRequest r) { throw new IllegalStateException("down"); }
            @Override public String structuredOutput(ChatRequest r) { throw new IllegalStateException("down"); }
            @Override public String name() { return "fake:down"; }
        };
    }

    @Test
    void mapsValidJsonToResult() throws Exception {
        String raw = """
                {"language":"zh-CN","contentType":"article","classification":"TUTORIAL",
                 "confidence":0.6,"topics":["虚拟线程","Spring Boot","Java 21"],
                 "entities":[{"name":"Spring Boot","kind":"TECHNOLOGY"},{"name":"Oracle","kind":"BOGUS"}],
                 "summary":"本文介绍虚拟线程实践。","keyPoints":["a","b","c"]}
                """;
        UnderstandingResult r = new RealUnderstandingProvider(providerReturning(raw)).understand("t", "body");

        assertEquals("zh-CN", r.language());
        assertEquals("article", r.contentType());
        assertEquals("TUTORIAL", r.classification());
        assertEquals("本文介绍虚拟线程实践。", r.summary());
        assertEquals("fake:test", r.model());

        JsonNode topics = JSON.readTree(r.topicsJson());
        assertEquals(3, topics.size());
        assertEquals("虚拟线程", topics.get(0).asText());

        // kind not in the allowed taxonomy is dropped
        JsonNode entities = JSON.readTree(r.entitiesJson());
        assertEquals(1, entities.size());
        assertEquals("Spring Boot", entities.get(0).path("name").asText());
        assertEquals("TECHNOLOGY", entities.get(0).path("kind").asText());
    }

    @Test
    void invalidClassificationFallsBackToOther() throws Exception {
        String raw = "{\"classification\":\"not-a-category\",\"summary\":\"ok\"}";
        UnderstandingResult r = new RealUnderstandingProvider(providerReturning(raw)).understand("t", "b");
        assertEquals("OTHER", r.classification());
    }

    @Test
    void topicsAreNormalizedDedupedAndCapped() throws Exception {
        StringBuilder raw = new StringBuilder("{\"classification\":\"NEWS\",\"summary\":\"s\",\"topics\":[");
        for (int i = 0; i < 15; i++) {
            if (i > 0) raw.append(',');
            raw.append("\"  Topic").append(i).append("  \"");
        }
        raw.append(",\"topic0\",\"TOPIC1\"]}"); // duplicates, case-insensitive

        UnderstandingResult r = new RealUnderstandingProvider(providerReturning(raw.toString())).understand("t", "b");
        JsonNode topics = JSON.readTree(r.topicsJson());
        assertEquals(10, topics.size(), "capped at MAX_TOPICS");
        assertEquals("Topic0", topics.get(0).asText(), "trimmed");
    }

    @Test
    void llmFailureDegradesToHeuristicInsteadOfThrowing() {
        UnderstandingResult r = new RealUnderstandingProvider(providerThrowing()).understand("t", "hello world");
        assertEquals("heuristic", r.model());
        assertEquals("OTHER", r.classification());
        assertEquals("hello world", r.summary());
    }

    @Test
    void malformedJsonDegradesToHeuristic() {
        UnderstandingResult r = new RealUnderstandingProvider(providerReturning("{not json")).understand("t", "b");
        assertEquals("heuristic", r.model());
    }

    @Test
    void missingSummaryDegradesToHeuristic() {
        String raw = "{\"classification\":\"NEWS\",\"topics\":[\"x\"]}";
        UnderstandingResult r = new RealUnderstandingProvider(providerReturning(raw)).understand("t", "b");
        assertEquals("heuristic", r.model());
    }
}
