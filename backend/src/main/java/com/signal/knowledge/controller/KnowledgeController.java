package com.signal.knowledge.controller;

import com.signal.common.ApiResponse;
import com.signal.knowledge.ChunkService;
import com.signal.knowledge.ChunkStore;
import com.signal.knowledge.KnowledgeAskService;
import com.signal.knowledge.KnowledgeSearchService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Phase 6 Knowledge API — K2 reindex, K3 search, K4 ask (RAG).
 * All routes inherit SecurityConfig: authenticated + user-scoped inside the service.
 */
@RestController
@RequestMapping("/api/v1/knowledge")
public class KnowledgeController {

    private final ChunkService chunks;
    private final ChunkStore store;
    private final KnowledgeSearchService search;
    private final KnowledgeAskService ask;

    public KnowledgeController(ChunkService chunks, ChunkStore store,
                               KnowledgeSearchService search, KnowledgeAskService ask) {
        this.chunks = chunks;
        this.store = store;
        this.search = search;
        this.ask = ask;
    }

    public record ReindexResponse(int scanned, int chunked, long chunks, int failed) {}

    /** Corpus shape for the console's first screen: what is indexed, and when. */
    public record StatsResponse(long documents, long chunks, long embedded, String lastIndexedAt) {}

    @GetMapping("/stats")
    public ApiResponse<StatsResponse> stats() {
        ChunkStore.Stats s = store.stats(userId());
        return ApiResponse.ok(new StatsResponse(s.documents(), s.chunks(), s.embedded(),
                s.lastIndexedAt() == null ? null : s.lastIndexedAt().toString()));
    }

    /** Rebuild the caller's whole retrieval corpus (idempotent; also refreshes embeddings after model change). */
    @PostMapping("/reindex")
    public ApiResponse<ReindexResponse> reindex() {
        UUID userId = userId();
        ChunkService.ReindexResult r = chunks.reindex(userId);
        return ApiResponse.ok(new ReindexResponse(r.scanned(), r.chunked(), r.chunks(), r.failed()));
    }

    /**
     * K3 retrieval over the caller's own corpus.
     * {@code mode} defaults to {@code HYBRID} (vector + keyword, RRF-fused);
     * {@code limit} defaults to 10 (max 50); {@code minScore} is a cosine-similarity floor
     * in [0, 1] and applies to the vector leg only. {@code rerank} defaults to true —
     * a cross-encoder reorders the fused candidates when a re-rank provider is configured
     * (see {@code reranked} in the response); set false to get pure retrieval order.
     */
    public record SearchRequest(
            @NotBlank @Size(max = 1000, message = "must be at most 1000 chars") String query,
            KnowledgeSearchService.Mode mode,
            Integer limit,
            Double minScore,
            Boolean rerank) {}

    @PostMapping("/search")
    public ApiResponse<KnowledgeSearchService.SearchResult> search(@Valid @RequestBody SearchRequest req) {
        return ApiResponse.ok(search.search(userId(), req.query(), req.mode(),
                req.limit(), req.minScore(), req.rerank()));
    }

    /**
     * K4 RAG — answer a question from the caller's own corpus, with citations.
     * Same retrieval knobs as {@code /search}; {@code status} reports whether the model
     * answered ({@code ANSWERED}), found nothing to work from ({@code NO_SOURCES}), or
     * had sources but could not answer ({@code NO_ANSWER}).
     */
    public record AskRequest(
            @NotBlank @Size(max = 1000, message = "must be at most 1000 chars") String question,
            Integer limit,
            Double minScore,
            Boolean rerank) {}

    @PostMapping("/ask")
    public ApiResponse<KnowledgeAskService.AskResult> ask(@Valid @RequestBody AskRequest req) {
        return ApiResponse.ok(ask.ask(userId(), req.question(), req.limit(), req.minScore(), req.rerank()));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
