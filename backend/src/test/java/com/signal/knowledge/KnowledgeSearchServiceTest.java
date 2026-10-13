package com.signal.knowledge;

import com.signal.ai.AIProperties;
import com.signal.ai.EmbeddingProvider;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KnowledgeSearchServiceTest {

    private static final int DIMENSIONS = AIProperties.DEFAULT_EMBEDDING_DIMENSIONS;

    /** Deterministic fake provider; records the texts it was asked to embed. */
    static class FakeEmbedder implements EmbeddingProvider {
        final List<String> seen = new ArrayList<>();
        int dims = DIMENSIONS;
        boolean fail = false;
        boolean failSilently = false;
        boolean empty = false;
        @Override public List<Double> embed(String text) {
            if (fail) throw new RuntimeException("provider down");
            if (failSilently) throw new RuntimeException();
            seen.add(text);
            if (empty) return List.of();
            List<Double> v = new ArrayList<>(dims);
            for (int i = 0; i < dims; i++) v.add(0.001 * (i + 1));
            return v;
        }
        @Override public String model() { return "fake-embed"; }
    }

    private final FakeEmbedder embedder = new FakeEmbedder();
    private final ChunkStore store = mock(ChunkStore.class);

    private KnowledgeSearchService svc() {
        return new KnowledgeSearchService(embedder, store, DIMENSIONS);
    }

    private static ScoredChunk vec(UUID id, String content, double score) {
        return new ScoredChunk(id, UUID.randomUUID(), 0, content, score, score, null,
                "Title", "https://example.com", "ARTICLE", "fake-embed");
    }

    private static ScoredChunk kw(UUID id, String content, double score) {
        return new ScoredChunk(id, UUID.randomUUID(), 0, content, score, null, score,
                "Title", "https://example.com", "ARTICLE", "fake-embed");
    }

    private void vectorLegReturns(ScoredChunk... hits) {
        when(store.searchByVector(any(), anyList(), anyInt(), anyDouble()))
                .thenReturn(List.of(hits));
    }

    private void keywordLegReturns(ScoredChunk... hits) {
        when(store.searchByKeyword(any(), any(), anyInt())).thenReturn(List.of(hits));
    }

    // ── blank / echo ───────────────────────────────────────────────────────────

    @Test void blankQueryEmbedsNothingAndMatchesNothing() {
        var r = svc().search(UUID.randomUUID(), "   ", null, null, null);
        assertEquals(0, r.count());
        assertTrue(r.results().isEmpty());
        assertEquals(KnowledgeSearchService.Mode.HYBRID, r.mode(), "HYBRID is the default");
        assertTrue(embedder.seen.isEmpty(), "blank query must not call the embedding provider");
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
        verify(store, never()).searchByKeyword(any(), any(), anyInt());
    }

    @Test void queryIsTrimmedBeforeEmbeddingAndResultsAreReturned() {
        UUID user = UUID.randomUUID();
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.9));
        keywordLegReturns();
        var r = svc().search(user, "  kubernetes autoscaling  ", null, null, null);

        assertEquals("kubernetes autoscaling", r.query(), "query echoed trimmed");
        assertEquals(List.of("kubernetes autoscaling"), embedder.seen);
        assertEquals(1, r.count());
        assertEquals("fake-embed", r.model());
        verify(store).searchByVector(eq(user), argThat(v -> v.size() == DIMENSIONS), eq(30), eq(0.0));
    }

    // ── mode routing ───────────────────────────────────────────────────────────

    @Test void vectorModeSkipsTheKeywordLeg() {
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.5));
        svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR, null, null);
        verify(store, never()).searchByKeyword(any(), any(), anyInt());
    }

    @Test void keywordModeSkipsEmbeddingEntirely() {
        keywordLegReturns(kw(UUID.randomUUID(), "a", 0.1));
        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.KEYWORD, null, null);

        assertEquals(1, r.count());
        assertTrue(embedder.seen.isEmpty(), "KEYWORD mode must not depend on the embedding provider");
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
        verify(store).searchByKeyword(any(), eq("kubernetes"), anyInt());
    }

    @Test void hybridModeRunsBothLegs() {
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.5));
        keywordLegReturns(kw(UUID.randomUUID(), "b", 0.1));
        var r = svc().search(UUID.randomUUID(), "kubernetes autoscaler", null, null, null);

        assertEquals(2, r.count(), "results from both legs are returned");
        verify(store).searchByVector(any(), anyList(), anyInt(), anyDouble());
        verify(store).searchByKeyword(any(), any(), anyInt());
    }

    @Test void keywordModeToleratesAQueryWithNoUsableTerms() {
        // "??" strips to nothing → the keyword leg is skipped rather than sending an empty tsquery.
        var r = svc().search(UUID.randomUUID(), "??", KnowledgeSearchService.Mode.KEYWORD, null, null);
        assertEquals(0, r.count());
        verify(store, never()).searchByKeyword(any(), any(), anyInt());
    }

    // ── RRF fusion ─────────────────────────────────────────────────────────────

    @Test void rrfRanksAChunkFoundByBothLegsAboveOneFoundByEitherAlone() {
        UUID both = UUID.randomUUID(), vectorOnly = UUID.randomUUID(), keywordOnly = UUID.randomUUID();
        // vector: both(1st), vectorOnly(2nd) ; keyword: both(1st), keywordOnly(2nd)
        vectorLegReturns(vec(both, "shared", 0.9), vec(vectorOnly, "v-only", 0.8));
        keywordLegReturns(kw(both, "shared", 0.5), kw(keywordOnly, "k-only", 0.4));

        var r = svc().search(UUID.randomUUID(), "kubernetes", null, null, null);

        assertEquals(3, r.count());
        assertEquals(both, r.results().get(0).chunkId(), "found by both legs → ranked first");
        // 1/61 + 1/61 > 1/62
        assertTrue(r.results().get(0).score() > r.results().get(1).score());
    }

    @Test void fusedChunkKeepsBothProvenanceScores() {
        UUID id = UUID.randomUUID();
        vectorLegReturns(vec(id, "shared", 0.77));
        keywordLegReturns(kw(id, "shared", 0.33));

        var r = svc().search(UUID.randomUUID(), "kubernetes", null, null, null);

        assertEquals(1, r.count());
        assertEquals(0.77, r.results().get(0).vectorScore());
        assertEquals(0.33, r.results().get(0).keywordScore());
    }

    @Test void singleLegHitsCarryOnlyTheirOwnProvenance() {
        vectorLegReturns(vec(UUID.randomUUID(), "v", 0.5));
        keywordLegReturns(kw(UUID.randomUUID(), "k", 0.2));
        var r = svc().search(UUID.randomUUID(), "kubernetes", null, null, null);

        var byVector = r.results().stream().filter(c -> c.vectorScore() != null).findFirst().orElseThrow();
        assertNull(byVector.keywordScore());
        var byKeyword = r.results().stream().filter(c -> c.keywordScore() != null).findFirst().orElseThrow();
        assertNull(byKeyword.vectorScore());
    }

    @Test void fusionRespectsTheLimit() {
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.9), vec(UUID.randomUUID(), "b", 0.8),
                vec(UUID.randomUUID(), "c", 0.7));
        keywordLegReturns(kw(UUID.randomUUID(), "d", 0.1));
        var r = svc().search(UUID.randomUUID(), "kubernetes", null, 2, null);
        assertEquals(2, r.count());
        assertEquals(2, r.results().size());
    }

    // ── clamping ───────────────────────────────────────────────────────────────

    @Test void limitDefaultsAndClamps() {
        assertEquals(10, KnowledgeSearchService.clampLimit(null));
        assertEquals(1, KnowledgeSearchService.clampLimit(0));
        assertEquals(1, KnowledgeSearchService.clampLimit(-5));
        assertEquals(25, KnowledgeSearchService.clampLimit(25));
        assertEquals(50, KnowledgeSearchService.clampLimit(500));
    }

    @Test void minScoreDefaultsAndClampsToUnitRange() {
        assertEquals(0.0, KnowledgeSearchService.clampMinScore(null));
        assertEquals(0.0, KnowledgeSearchService.clampMinScore(-0.2));
        assertEquals(0.35, KnowledgeSearchService.clampMinScore(0.35));
        assertEquals(1.0, KnowledgeSearchService.clampMinScore(9.0));
    }

    @Test void effectiveLimitAndMinScoreReachTheVectorLeg() {
        vectorLegReturns();
        keywordLegReturns();
        // A >=2-char term is required, otherwise toWebsearchQuery drops it and the keyword
        // leg is legitimately skipped — so the query here must be a real word, not "q".
        svc().search(UUID.randomUUID(), "kubernetes", null, 999, 5.0);
        // limit clamped to 50 → pool = min(max(150,20),100) = 100, applied to both legs
        verify(store).searchByVector(any(), anyList(), eq(100), eq(1.0));
        verify(store).searchByKeyword(any(), any(), eq(100));
    }

    @Test void legPoolIsBounded() {
        assertEquals(20, KnowledgeSearchService.legPool(1));
        assertEquals(30, KnowledgeSearchService.legPool(10));
        assertEquals(100, KnowledgeSearchService.legPool(50));
    }

    // ── tsquery construction ───────────────────────────────────────────────────

    @Test void websearchQueryStripsPunctuationAndKeepsIdentifiers() {
        assertEquals("how or does or kubernetes or autoscale or pods",
                KnowledgeSearchService.toWebsearchQuery("How does Kubernetes autoscale pods?"));
        assertEquals("node.js or spring_boot or gpt-4",
                KnowledgeSearchService.toWebsearchQuery("node.js spring_boot gpt-4"));
        assertEquals("c++", KnowledgeSearchService.toWebsearchQuery("c++"));
        // A leading '-' would be read by websearch as negation — it must be stripped.
        assertEquals("foo", KnowledgeSearchService.toWebsearchQuery("-foo"));
    }

    @Test void websearchQueryDropsShortTermsAndCapsLength() {
        assertNull(KnowledgeSearchService.toWebsearchQuery("a b ?!"), "single chars are noise");
        assertNull(KnowledgeSearchService.toWebsearchQuery("?!..."), "nothing usable remains");
        assertNull(KnowledgeSearchService.toWebsearchQuery(null));

        String long10 = "t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 t11 t12 t13 t14";
        assertEquals(KnowledgeSearchService.MAX_TERMS,
                KnowledgeSearchService.toWebsearchQuery(long10).split(" or ").length);
    }

    @Test void websearchQueryKeepsCjkTerms() {
        assertEquals("自动扩缩容", KnowledgeSearchService.toWebsearchQuery("自动扩缩容"));
    }

    // ── failure handling ───────────────────────────────────────────────────────

    @Test void dimensionMismatchFailsLoudly() {
        embedder.dims = 8;
        var ex = assertThrows(IllegalStateException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null));
        assertTrue(ex.getMessage().contains("dim"), ex.getMessage());
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
    }

    @Test void providerFailureSurfacesAsUnavailableNotEmptyResults() {
        embedder.fail = true;
        var ex = assertThrows(KnowledgeSearchService.SearchUnavailableException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null));
        assertEquals("provider down", ex.getMessage(), "provider detail is passed through verbatim, not re-prefixed");
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
    }

    @Test void providerFailureWithNoMessageStillYieldsUsableError() {
        embedder.failSilently = true;
        var ex = assertThrows(KnowledgeSearchService.SearchUnavailableException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null));
        assertEquals("embedding provider call failed", ex.getMessage());
    }

    @Test void emptyVectorFromProviderSurfacesAsUnavailable() {
        embedder.empty = true;
        assertThrows(KnowledgeSearchService.SearchUnavailableException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null));
    }
}
