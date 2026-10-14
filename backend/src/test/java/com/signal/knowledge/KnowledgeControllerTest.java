package com.signal.knowledge;

import com.signal.common.GlobalExceptionHandler;
import com.signal.knowledge.controller.KnowledgeController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Standalone MockMvc (no Spring context, no DB) covering the K3 endpoint contract:
 * path wiring, principal → userId propagation (user isolation), request validation,
 * and the 502 mapping when the embedding provider is unavailable.
 */
class KnowledgeControllerTest {

    private final ChunkService chunks = mock(ChunkService.class);
    private final KnowledgeSearchService search = mock(KnowledgeSearchService.class);
    private final KnowledgeAskService ask = mock(KnowledgeAskService.class);

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new KnowledgeController(chunks, search, ask))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    private final UUID userId = UUID.randomUUID();

    private void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void searchReturnsEnvelopeWithResults() throws Exception {
        authenticate();
        when(search.search(eq(userId), eq("kubernetes"), eq(KnowledgeSearchService.Mode.VECTOR), eq(3), eq(0.25), isNull()))
                .thenReturn(new KnowledgeSearchService.SearchResult(
                        "kubernetes", KnowledgeSearchService.Mode.VECTOR, "fake-embed", 3, 0.25, 1, false, null,
                        List.of(new ScoredChunk(UUID.randomUUID(), UUID.randomUUID(), 0,
                                "body", 0.42, 0.42, null, "Title", "https://example.com", "ARTICLE", "fake-embed"))));

        mockMvc.perform(post("/api/v1/knowledge/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"kubernetes\",\"mode\":\"VECTOR\",\"limit\":3,\"minScore\":0.25}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.count").value(1))
                .andExpect(jsonPath("$.data.mode").value("VECTOR"))
                .andExpect(jsonPath("$.data.model").value("fake-embed"))
                .andExpect(jsonPath("$.data.results[0].title").value("Title"))
                .andExpect(jsonPath("$.data.results[0].score").value(0.42))
                .andExpect(jsonPath("$.data.results[0].vectorScore").value(0.42));

        // the authenticated principal (not a request field) drives user scoping
        verify(search).search(eq(userId), eq("kubernetes"), eq(KnowledgeSearchService.Mode.VECTOR), eq(3), eq(0.25), isNull());
    }

    @Test
    void searchDefaultsToHybridModeWhenModeOmitted() throws Exception {
        authenticate();
        when(search.search(any(), any(), isNull(), any(), any(), any()))
                .thenReturn(new KnowledgeSearchService.SearchResult(
                        "q", KnowledgeSearchService.Mode.HYBRID, "fake-embed", 10, 0.0, 0, false, null, List.of()));

        mockMvc.perform(post("/api/v1/knowledge/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"q\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mode").value("HYBRID"));

        verify(search).search(any(), any(), isNull(), any(), any(), any());
    }

    @Test
    void rerankFlagIsPassedThroughAndEchoed() throws Exception {
        authenticate();
        when(search.search(any(), any(), any(), any(), any(), eq(Boolean.FALSE)))
                .thenReturn(new KnowledgeSearchService.SearchResult(
                        "q", KnowledgeSearchService.Mode.HYBRID, "fake-embed", 10, 0.0, 0, false, null, List.of()));

        mockMvc.perform(post("/api/v1/knowledge/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"q\",\"rerank\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reranked").value(false));

        verify(search).search(any(), any(), any(), any(), any(), eq(Boolean.FALSE));
    }

    @Test
    void unknownModeIsRejectedAs400() throws Exception {
        authenticate();
        mockMvc.perform(post("/api/v1/knowledge/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"q\",\"mode\":\"TELEPATHY\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        verify(search, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void missingQueryReturns400() throws Exception {
        authenticate();
        mockMvc.perform(post("/api/v1/knowledge/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        verify(search, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void searchUnavailableMapsTo502() throws Exception {
        authenticate();
        when(search.search(any(), any(), any(), any(), any(), any()))
                .thenThrow(new KnowledgeSearchService.SearchUnavailableException("provider down"));

        mockMvc.perform(post("/api/v1/knowledge/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"anything\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.code").value("SEARCH_UNAVAILABLE"));
    }

    @Test
    void reindexReturnsCounts() throws Exception {
        authenticate();
        when(chunks.reindex(userId)).thenReturn(new ChunkService.ReindexResult(2, 2, 7, 0));

        mockMvc.perform(post("/api/v1/knowledge/reindex"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scanned").value(2))
                .andExpect(jsonPath("$.data.chunks").value(7))
                .andExpect(jsonPath("$.data.failed").value(0));
    }

    @Test
    void askReturnsAnswerWithCitations() throws Exception {
        authenticate();
        UUID chunkId = UUID.randomUUID();
        when(ask.ask(eq(userId), eq("What is autoscaling?"), eq(5), isNull(), isNull()))
                .thenReturn(new KnowledgeAskService.AskResult(
                        "What is autoscaling?", KnowledgeAskService.Status.ANSWERED,
                        "It adds pods based on metrics [1].",
                        "openai-compatible:modelscope", "fake-embed", 1, false, null,
                        List.of(new KnowledgeAskService.Citation(1, chunkId, UUID.randomUUID(),
                                "Autoscaling", "https://example.com", "ARTICLE", 0.44))));

        mockMvc.perform(post("/api/v1/knowledge/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"What is autoscaling?\",\"limit\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("ANSWERED"))
                .andExpect(jsonPath("$.data.answer").value("It adds pods based on metrics [1]."))
                .andExpect(jsonPath("$.data.citations[0].index").value(1))
                .andExpect(jsonPath("$.data.citations[0].title").value("Autoscaling"));

        verify(ask).ask(eq(userId), eq("What is autoscaling?"), eq(5), isNull(), isNull());
    }

    @Test
    void askWithoutQuestionReturns400() throws Exception {
        authenticate();
        mockMvc.perform(post("/api/v1/knowledge/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        verify(ask, never()).ask(any(), any(), any(), any(), any());
    }
}
