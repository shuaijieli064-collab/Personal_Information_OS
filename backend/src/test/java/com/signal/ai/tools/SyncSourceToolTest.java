package com.signal.ai.tools;

import com.signal.ingestion.service.IngestionService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SyncSourceToolTest {

    private final IngestionService ingestion = mock(IngestionService.class);
    private final SyncSourceTool tool = new SyncSourceTool(ingestion);

    @Test
    void permissionIsWrite() {
        assertEquals(ToolPermission.WRITE, tool.permission());
        assertEquals(List.of("sourceId"), tool.requiredParameters());
    }

    @Test
    void missingSourceIdThrows() {
        assertThrows(ToolInvocationException.class, () -> tool.execute(UUID.randomUUID(), Map.of()));
    }

    @Test
    void nonUuidSourceIdThrows() {
        assertThrows(ToolInvocationException.class,
                () -> tool.execute(UUID.randomUUID(), Map.<String, Object>of("sourceId", "not-a-uuid")));
    }

    @Test
    void delegatesToIngestionSync() throws Exception {
        UUID user = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        when(ingestion.sync(user, sourceId))
                .thenReturn(new IngestionService.SyncResult(sourceId, 5, 3, 1, 1, 0, List.of(), null));

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.<String, Object>of("sourceId", sourceId.toString()));

        assertEquals(sourceId, out.get("sourceId"));
        assertEquals(5, out.get("fetched"));
        assertEquals(3, out.get("created"));
        assertEquals(1, out.get("duplicates"));
        verify(ingestion).sync(user, sourceId);
    }
}
