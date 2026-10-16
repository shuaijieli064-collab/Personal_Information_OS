package com.signal.ai.tools;

import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListSignalsToolTest {

    private final SignalRepository signals = mock(SignalRepository.class);
    private final ListSignalsTool tool = new ListSignalsTool(signals);

    @Test
    void permissionIsReadAndHasNoRequiredArgs() {
        assertEquals(ToolPermission.READ, tool.permission());
        assertTrue(tool.requiredParameters().isEmpty());
    }

    @Test
    void delegatesToRepositoryAndMapsSignals() throws Exception {
        UUID user = UUID.randomUUID();
        Signal s = new Signal();
        s.setTitle("Big news");
        s.setSignalScore(8.5);
        s.setStatus("IMPORTANT");

        when(signals.findByUserIdOrderBySignalScoreDesc(eq(user), any()))
                .thenReturn(new PageImpl<>(List.of(s), PageRequest.of(0, 20), 1));

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.of());

        assertEquals(1, out.get("count"));
        Map<?, ?> item = (Map<?, ?>) ((List<?>) out.get("signals")).get(0);
        assertEquals("Big news", item.get("title"));
        assertEquals(8.5, item.get("signalScore"));
        assertEquals("IMPORTANT", item.get("status"));
        verify(signals).findByUserIdOrderBySignalScoreDesc(eq(user), any());
    }
}
