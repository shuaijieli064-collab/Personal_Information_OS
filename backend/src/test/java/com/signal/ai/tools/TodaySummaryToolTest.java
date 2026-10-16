package com.signal.ai.tools;

import com.signal.ingestion.repository.InformationRepository;
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

class TodaySummaryToolTest {

    private final InformationRepository information = mock(InformationRepository.class);
    private final SignalRepository signals = mock(SignalRepository.class);
    private final TodaySummaryTool tool = new TodaySummaryTool(information, signals);

    @Test
    void permissionIsReadAndHasNoRequiredArgs() {
        assertEquals(ToolPermission.READ, tool.permission());
        assertTrue(tool.requiredParameters().isEmpty());
    }

    @Test
    void returnsTheSameCountsAsTheTodayDashboard() throws Exception {
        UUID user = UUID.randomUUID();
        Signal important = new Signal();
        important.setStatus("IMPORTANT");
        Signal other = new Signal();
        other.setStatus("ACTIVE");

        when(information.findByUserId(eq(user), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1), 12));
        when(signals.findByUserIdOrderBySignalScoreDesc(eq(user), any()))
                .thenReturn(new PageImpl<>(List.of(important, other), PageRequest.of(0, 100), 2));

        Map<?, ?> out = (Map<?, ?>) tool.execute(user, Map.of());

        assertEquals(12L, out.get("informationCount"));
        assertEquals(2L, out.get("signalCount"));
        assertEquals(1L, out.get("actionRequired"));
    }
}
