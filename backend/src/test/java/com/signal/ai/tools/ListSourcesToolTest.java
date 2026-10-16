package com.signal.ai.tools;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.repository.SourceRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ListSourcesToolTest {

    private final SourceRepository sources = mock(SourceRepository.class);
    private final ListSourcesTool tool = new ListSourcesTool(sources);

    @Test
    void permissionIsReadAndHasNoRequiredArgs() {
        assertEquals(ToolPermission.READ, tool.permission());
        assertTrue(tool.requiredParameters().isEmpty());
    }

    @Test
    void delegatesToRepositoryAndMapsSources() throws Exception {
        UUID user = UUID.randomUUID();
        Source s = new Source();
        s.setName("Hacker News");
        s.setType("RSS");
        s.setUrl("https://news.ycombinator.com/rss");

        when(sources.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of(s));

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.of());

        assertEquals(1, out.get("count"));
        Map<?, ?> item = (Map<?, ?>) ((List<?>) out.get("sources")).get(0);
        assertEquals("Hacker News", item.get("name"));
        assertEquals("RSS", item.get("type"));
        assertEquals("https://news.ycombinator.com/rss", item.get("url"));
        verify(sources).findAllByUserIdOrderByCreatedAtDesc(user);
    }
}
