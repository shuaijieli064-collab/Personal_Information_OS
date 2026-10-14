package com.signal.ai;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * DashScope re-rank adapter — response parsing contract and failure semantics.
 * Live HTTP was verified separately (2026-10-14, HTTP 200); these pin the shape.
 */
class DashScopeRerankProviderTest {

    private static byte[] utf8(String s) { return s.getBytes(StandardCharsets.UTF_8); }

    /** A provider wired to a dead port: no network dependency, but exercises the real call path. */
    private static DashScopeRerankProvider deadProvider() {
        AIProperties props = new AIProperties("test", "http://127.0.0.1:1", "m", "k",
                null, "", "", 0, null, "http://127.0.0.1:1", "k", 200, 0);
        return new DashScopeRerankProvider(props);
    }

    @Test void pathIsTheNativeDashScopeRerankSurface() {
        assertEquals("/services/rerank/text-rerank/text-rerank", DashScopeRerankProvider.RERANK_PATH);
    }

    @Test void parsesAndSortsByRelevance() {
        List<RerankProvider.RerankHit> hits = DashScopeRerankProvider.parseRerank(utf8("""
                {"output":{"results":[
                  {"index":2,"relevance_score":0.10},
                  {"index":0,"relevance_score":0.90},
                  {"index":1,"relevance_score":0.50}]},
                 "usage":{"total_tokens":42}}"""));

        assertEquals(List.of(0, 1, 2), hits.stream().map(RerankProvider.RerankHit::index).toList(),
                "hits are returned best-first regardless of the vendor's ordering");
        assertEquals(0.90, hits.get(0).score(), 1e-9);
        assertEquals(0.10, hits.get(2).score(), 1e-9);
    }

    @Test void missingResultsThrows() {
        assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> DashScopeRerankProvider.parseRerank(utf8("{\"output\":{}}")));
    }

    @Test void malformedEntryThrows() {
        assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> DashScopeRerankProvider.parseRerank(
                        utf8("{\"output\":{\"results\":[{\"index\":0}]}}")));
    }

    @Test void emptyDocumentsShortCircuitWithoutAnyHttpCall() {
        assertTrue(deadProvider().rerank("q", List.of(), 5).isEmpty(),
                "no documents → nothing to score, and no request is attempted");
    }

    @Test void unreachableProviderThrowsAIException() {
        var ex = assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> deadProvider().rerank("q", List.of("a", "b"), 2));
        assertTrue(ex.getMessage().contains("unavailable"), ex.getMessage());
    }

    @Test void modelComesFromConfiguration() {
        AIProperties props = new AIProperties("test", "http://x", "m", "k",
                null, "", "", 0, "my-rerank-model", "http://x", "k", 500, 0);
        assertEquals("my-rerank-model", new DashScopeRerankProvider(props).model());
    }
}
