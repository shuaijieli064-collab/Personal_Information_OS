package com.signal.ai.tools;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ArchiveInformationToolTest {

    private final InformationRepository information = mock(InformationRepository.class);
    private final ArchiveInformationTool tool = new ArchiveInformationTool(information);

    @Test
    void permissionIsWrite() {
        assertEquals(ToolPermission.WRITE, tool.permission());
        assertEquals(List.of("informationId"), tool.requiredParameters());
    }

    @Test
    void missingInformationIdThrows() {
        assertThrows(ToolInvocationException.class, () -> tool.execute(UUID.randomUUID(), Map.of()));
    }

    @Test
    void delegatesAndArchives() throws Exception {
        UUID user = UUID.randomUUID();
        UUID infoId = UUID.randomUUID();
        Information info = new Information();
        info.setId(infoId);
        info.setStatus("ACTIVE");
        when(information.findByIdAndUserId(infoId, user)).thenReturn(Optional.of(info));
        when(information.save(info)).thenReturn(info);

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.<String, Object>of("informationId", infoId.toString()));

        assertEquals("ARCHIVED", info.getStatus());
        assertEquals("ARCHIVED", out.get("status"));
        verify(information).save(info);
    }

    @Test
    void anotherUsersInformationIsNotFound() {
        UUID user = UUID.randomUUID();
        UUID infoId = UUID.randomUUID();
        when(information.findByIdAndUserId(infoId, user)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> tool.execute(user, Map.<String, Object>of("informationId", infoId.toString())));
        verify(information, never()).save(any());
    }
}
