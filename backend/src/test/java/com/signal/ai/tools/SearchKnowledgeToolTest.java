package com.signal.ai.tools;

import com.signal.knowledge.KnowledgeSearchService;
import com.signal.knowledge.ScoredChunk;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SearchKnowledgeToolTest {

    private final KnowledgeSearchService search = mock(KnowledgeSearchService.class);
    private final SearchKnowledgeTool tool = new SearchKnowledgeTool(search);

    @Test
    void missingQueryThrows() {
        assertThrows(ToolInvocationException.class, () -> tool.execute(UUID.randomUUID(), Map.of()));
    }

    @Test
    void permissionIsRead() {
        assertEquals(ToolPermission.READ, tool.permission());
        assertEquals("searchKnowledge", tool.name());
        assertEquals(List.of("query"), tool.requiredParameters());
    }

    @Test
    void delegatesToSearchAndMapsResults() throws Exception {
        UUID user = UUID.randomUUID();
        when(search.search(eq(user), eq("k8s"), eq(KnowledgeSearchService.Mode.HYBRID), eq(5), isNull(), isNull()))
                .thenReturn(new KnowledgeSearchService.SearchResult(
                        "k8s", KnowledgeSearchService.Mode.HYBRID, "fake-embed", 5, 0.0, 1, false, null,
                        List.of(new ScoredChunk(UUID.randomUUID(), UUID.randomUUID(), 0,
                                "body text", 0.7, 0.7, null, "Title", "u", "ARTICLE", "m"))));

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.<String, Object>of("query", "k8s", "limit", 5));

        assertEquals(1, out.get("count"));
        Map<?, ?> hit = (Map<?, ?>) ((List<?>) out.get("results")).get(0);
        assertEquals("Title", hit.get("title"));
        assertEquals(0.7, hit.get("score"));
        assertEquals("body text", hit.get("snippet"));
        verify(search).search(user, "k8s", KnowledgeSearchService.Mode.HYBRID, 5, null, null);
    }
}
