package com.signal.ai.tools;

import com.signal.knowledge.KnowledgeAskService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AskKnowledgeToolTest {

    private final KnowledgeAskService ask = mock(KnowledgeAskService.class);
    private final AskKnowledgeTool tool = new AskKnowledgeTool(ask);

    @Test
    void missingQuestionThrows() {
        assertThrows(ToolInvocationException.class, () -> tool.execute(UUID.randomUUID(), Map.of()));
    }

    @Test
    void permissionIsRead() {
        assertEquals(ToolPermission.READ, tool.permission());
    }

    @Test
    void delegatesToAskAndMapsResult() throws Exception {
        UUID user = UUID.randomUUID();
        when(ask.ask(eq(user), eq("what?"), isNull(), isNull(), isNull()))
                .thenReturn(new KnowledgeAskService.AskResult(
                        "what?", KnowledgeAskService.Status.ANSWERED, "an answer [1]",
                        "model", "embed", 1, 1, false, null,
                        List.of(new KnowledgeAskService.Citation(1, UUID.randomUUID(), UUID.randomUUID(),
                                "Title", "https://example.com", "ARTICLE", 0.5))));

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.<String, Object>of("question", "what?"));

        assertEquals("ANSWERED", out.get("status"));
        assertEquals("an answer [1]", out.get("answer"));
        Map<?, ?> citation = (Map<?, ?>) ((List<?>) out.get("citations")).get(0);
        assertEquals(1, citation.get("index"));
        assertEquals("Title", citation.get("title"));
        verify(ask).ask(user, "what?", null, null, null);
    }
}
