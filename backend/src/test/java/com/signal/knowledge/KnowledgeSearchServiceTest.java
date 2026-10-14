package com.signal.knowledge;

import com.signal.ai.AIProperties;
import com.signal.ai.EmbeddingProvider;
import com.signal.ai.RerankProvider;
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

    /**
     * Fake cross-encoder. Disabled by default so the pre-existing tests keep pure
     * retrieval semantics; a re-rank test opts in via {@link #enabled} + {@link #hits}.
     */
    static class FakeReranker implements RerankProvider {
        final List<String> seen = new ArrayList<>();
        List<RerankHit> hits = List.of();
        boolean enabled = false;
        boolean fail = false;
        int lastDocs = -1;
        @Override public List<RerankHit> rerank(String query, List<String> documents, int topN) {
            seen.add(query);
            lastDocs = documents.size();
            if (fail) throw new RuntimeException("rerank down");
            return hits;
        }
        @Override public String model() { return "fake-rerank"; }
        @Override public boolean available() { return enabled; }
    }

    private final FakeEmbedder embedder = new FakeEmbedder();
    private final ChunkStore store = mock(ChunkStore.class);
    private final FakeReranker reranker = new FakeReranker();

    private KnowledgeSearchService svc() {
        return new KnowledgeSearchService(embedder, store, reranker, DIMENSIONS);
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
        var r = svc().search(UUID.randomUUID(), "   ", null, null, null, null);
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
        var r = svc().search(user, "  kubernetes autoscaling  ", null, null, null, null);

        assertEquals("kubernetes autoscaling", r.query(), "query echoed trimmed");
        assertEquals(List.of("kubernetes autoscaling"), embedder.seen);
        assertEquals(1, r.count());
        assertEquals("fake-embed", r.model());
        verify(store).searchByVector(eq(user), argThat(v -> v.size() == DIMENSIONS), eq(30), eq(0.0));
    }

    // ── mode routing ───────────────────────────────────────────────────────────

    @Test void vectorModeSkipsTheKeywordLeg() {
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.5));
        svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR, null, null, null);
        verify(store, never()).searchByKeyword(any(), any(), anyInt());
    }

    @Test void keywordModeSkipsEmbeddingEntirely() {
        keywordLegReturns(kw(UUID.randomUUID(), "a", 0.1));
        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.KEYWORD, null, null, null);

        assertEquals(1, r.count());
        assertTrue(embedder.seen.isEmpty(), "KEYWORD mode must not depend on the embedding provider");
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
        verify(store).searchByKeyword(any(), eq("kubernetes"), anyInt());
    }

    @Test void hybridModeRunsBothLegs() {
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.5));
        keywordLegReturns(kw(UUID.randomUUID(), "b", 0.1));
        var r = svc().search(UUID.randomUUID(), "kubernetes autoscaler", null, null, null, null);

        assertEquals(2, r.count(), "results from both legs are returned");
        verify(store).searchByVector(any(), anyList(), anyInt(), anyDouble());
        verify(store).searchByKeyword(any(), any(), anyInt());
    }

    @Test void keywordModeToleratesAQueryWithNoUsableTerms() {
        // "??" strips to nothing → the keyword leg is skipped rather than sending an empty tsquery.
        var r = svc().search(UUID.randomUUID(), "??", KnowledgeSearchService.Mode.KEYWORD, null, null, null);
        assertEquals(0, r.count());
        verify(store, never()).searchByKeyword(any(), any(), anyInt());
    }

    // ── RRF fusion ─────────────────────────────────────────────────────────────

    @Test void rrfRanksAChunkFoundByBothLegsAboveOneFoundByEitherAlone() {
        UUID both = UUID.randomUUID(), vectorOnly = UUID.randomUUID(), keywordOnly = UUID.randomUUID();
        // vector: both(1st), vectorOnly(2nd) ; keyword: both(1st), keywordOnly(2nd)
        vectorLegReturns(vec(both, "shared", 0.9), vec(vectorOnly, "v-only", 0.8));
        keywordLegReturns(kw(both, "shared", 0.5), kw(keywordOnly, "k-only", 0.4));

        var r = svc().search(UUID.randomUUID(), "kubernetes", null, null, null, null);

        assertEquals(3, r.count());
        assertEquals(both, r.results().get(0).chunkId(), "found by both legs → ranked first");
        // 1/61 + 1/61 > 1/62
        assertTrue(r.results().get(0).score() > r.results().get(1).score());
    }

    @Test void fusedChunkKeepsBothProvenanceScores() {
        UUID id = UUID.randomUUID();
        vectorLegReturns(vec(id, "shared", 0.77));
        keywordLegReturns(kw(id, "shared", 0.33));

        var r = svc().search(UUID.randomUUID(), "kubernetes", null, null, null, null);

        assertEquals(1, r.count());
        assertEquals(0.77, r.results().get(0).vectorScore());
        assertEquals(0.33, r.results().get(0).keywordScore());
    }

    @Test void singleLegHitsCarryOnlyTheirOwnProvenance() {
        vectorLegReturns(vec(UUID.randomUUID(), "v", 0.5));
        keywordLegReturns(kw(UUID.randomUUID(), "k", 0.2));
        var r = svc().search(UUID.randomUUID(), "kubernetes", null, null, null, null);

        var byVector = r.results().stream().filter(c -> c.vectorScore() != null).findFirst().orElseThrow();
        assertNull(byVector.keywordScore());
        var byKeyword = r.results().stream().filter(c -> c.keywordScore() != null).findFirst().orElseThrow();
        assertNull(byKeyword.vectorScore());
    }

    @Test void fusionRespectsTheLimit() {
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.9), vec(UUID.randomUUID(), "b", 0.8),
                vec(UUID.randomUUID(), "c", 0.7));
        keywordLegReturns(kw(UUID.randomUUID(), "d", 0.1));
        var r = svc().search(UUID.randomUUID(), "kubernetes", null, 2, null, null);
        assertEquals(2, r.count());
        assertEquals(2, r.results().size());
    }

    // ── re-ranking (cross-encoder precision pass) ──────────────────────────────

    @Test void rerankReordersCandidatesAndReplacesTheScore() {
        reranker.enabled = true;
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        vectorLegReturns(vec(a, "aaa", 0.9), vec(b, "bbb", 0.8), vec(c, "ccc", 0.7));
        keywordLegReturns();
        // cross-encoder says: c (best), then a, then b — the opposite of retrieval order
        reranker.hits = List.of(new RerankProvider.RerankHit(2, 0.95),
                new RerankProvider.RerankHit(0, 0.40),
                new RerankProvider.RerankHit(1, 0.10));

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                null, null, null);

        assertTrue(r.reranked());
        assertEquals("fake-rerank", r.rerankModel());
        assertEquals(List.of(c, a, b), r.results().stream().map(ScoredChunk::chunkId).toList());
        assertEquals(0.95, r.results().get(0).score(), 1e-9, "score becomes the rerank relevance");
        assertEquals(0.7, r.results().get(0).vectorScore(), 1e-9, "vector provenance is preserved");
        assertEquals(List.of("kubernetes"), reranker.seen);
    }

    @Test void rerankOverFetchesAWiderCandidatePoolThanTheResultLimit() {
        reranker.enabled = true;
        ScoredChunk[] many = new ScoredChunk[25];
        for (int i = 0; i < many.length; i++) many[i] = vec(UUID.randomUUID(), "chunk-" + i, 0.9 - i * 0.01);
        vectorLegReturns(many);
        keywordLegReturns();
        reranker.hits = List.of(new RerankProvider.RerankHit(0, 0.9));

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                2, null, null);

        assertEquals(20, reranker.lastDocs, "pool = rerankPool(2) = 20, not the result limit 2");
        assertEquals(2, r.count(), "the final list still respects the limit");
    }

    @Test void rerankPreservesCandidatesTheProviderDidNotReturn() {
        reranker.enabled = true;
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        vectorLegReturns(vec(a, "a", 0.9), vec(b, "b", 0.8));
        keywordLegReturns();
        // duplicate + out-of-range indices must be ignored, never crash; 'a' is missing
        // from the response so it is appended rather than dropped.
        reranker.hits = List.of(new RerankProvider.RerankHit(1, 0.9),
                new RerankProvider.RerankHit(1, 0.8),
                new RerankProvider.RerankHit(99, 0.7));

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                null, null, null);

        assertTrue(r.reranked());
        assertEquals(List.of(b, a), r.results().stream().map(ScoredChunk::chunkId).toList(),
                "reordered, but no candidate is lost");
    }

    @Test void rerankFalseKeepsRetrievalOrderAndSkipsTheProvider() {
        reranker.enabled = true;
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.9), vec(UUID.randomUUID(), "b", 0.8));
        keywordLegReturns();

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                null, null, false);

        assertFalse(r.reranked());
        assertNull(r.rerankModel());
        assertTrue(reranker.seen.isEmpty(), "rerank=false must not call the provider");
        assertEquals(0.9, r.results().get(0).score(), 1e-9, "retrieval score is untouched");
    }

    @Test void rerankFailureKeepsRetrievalOrderWithoutThrowing() {
        reranker.enabled = true;
        reranker.fail = true;
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        vectorLegReturns(vec(a, "a", 0.9), vec(b, "b", 0.8));
        keywordLegReturns();

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                null, null, null);

        assertFalse(r.reranked(), "a rerank outage degrades, it never fails the search");
        assertNull(r.rerankModel());
        assertEquals(List.of(a, b), r.results().stream().map(ScoredChunk::chunkId).toList());
        assertEquals(0.9, r.results().get(0).score(), 1e-9);
    }

    @Test void unavailableProviderSkipsRerankEntirely() {
        // enabled stays false → available() == false, so the call is never attempted
        vectorLegReturns(vec(UUID.randomUUID(), "a", 0.9), vec(UUID.randomUUID(), "b", 0.8));
        keywordLegReturns();

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                null, null, null);

        assertFalse(r.reranked());
        assertTrue(reranker.seen.isEmpty());
    }

    @Test void rerankIsSkippedWhenThereIsNothingToReorder() {
        reranker.enabled = true;
        vectorLegReturns(vec(UUID.randomUUID(), "only", 0.5));
        keywordLegReturns();

        var r = svc().search(UUID.randomUUID(), "kubernetes", KnowledgeSearchService.Mode.VECTOR,
                null, null, null);

        assertFalse(r.reranked());
        assertTrue(reranker.seen.isEmpty(), "a single candidate needs no cross-encoder pass");
    }

    @Test void rerankPoolIsBoundedAndNeverExceedsTheLegPool() {
        assertEquals(20, KnowledgeSearchService.rerankPool(1));
        assertEquals(20, KnowledgeSearchService.rerankPool(10));
        assertEquals(50, KnowledgeSearchService.rerankPool(50));
        for (int limit : new int[]{1, 5, 10, 20, 50}) {
            assertTrue(KnowledgeSearchService.rerankPool(limit) <= KnowledgeSearchService.legPool(limit),
                    "legs must fetch at least as many rows as the re-ranker is handed (limit=" + limit + ")");
        }
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
        svc().search(UUID.randomUUID(), "kubernetes", null, 999, 5.0, null);
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
                () -> svc().search(UUID.randomUUID(), "q", null, null, null, null));
        assertTrue(ex.getMessage().contains("dim"), ex.getMessage());
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
    }

    @Test void providerFailureSurfacesAsUnavailableNotEmptyResults() {
        embedder.fail = true;
        var ex = assertThrows(KnowledgeSearchService.SearchUnavailableException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null, null));
        assertEquals("provider down", ex.getMessage(), "provider detail is passed through verbatim, not re-prefixed");
        verify(store, never()).searchByVector(any(), anyList(), anyInt(), anyDouble());
    }

    @Test void providerFailureWithNoMessageStillYieldsUsableError() {
        embedder.failSilently = true;
        var ex = assertThrows(KnowledgeSearchService.SearchUnavailableException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null, null));
        assertEquals("embedding provider call failed", ex.getMessage());
    }

    @Test void emptyVectorFromProviderSurfacesAsUnavailable() {
        embedder.empty = true;
        assertThrows(KnowledgeSearchService.SearchUnavailableException.class,
                () -> svc().search(UUID.randomUUID(), "q", null, null, null, null));
    }
}
