package com.signal.understanding;

import com.signal.ai.AIProvider;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.SummaryService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SummaryServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository repo = mock(InformationUnderstandingRepository.class);

    private SummaryService svc(String resp) {
        AIProvider ai = new AIProvider() {
            public String chat(ChatRequest r) { return resp; }
            public String structuredOutput(ChatRequest r) { return resp; }
            public String name() { return "stub"; }
        };
        return new SummaryService(infoRepo, repo, ai);
    }

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID()); i.setUserId(UUID.randomUUID());
        i.setTitle("t"); i.setContent("c");
        return i;
    }

    private InformationUnderstanding runOnce(String resp) {
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(info()));
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));
        svc(resp).summarize(UUID.randomUUID(), UUID.randomUUID());
        ArgumentCaptor<InformationUnderstanding> cap = ArgumentCaptor.forClass(InformationUnderstanding.class);
        verify(repo).save(cap.capture());
        return cap.getValue();
    }

    @Test void validSummaryAccepted() {
        InformationUnderstanding r = runOnce(
                "{\"summary\":\"This article explains virtual threads in Java 21 and their impact on concurrency.\"," +
                "\"keyPoints\":[\"Point A\",\"Point B\",\"Point C\"]}");
        assertEquals("COMPLETED", r.getStatus());
        assertNotNull(r.getSummary());
    }

    @Test void tooShortSummaryMarksFailed() {
        assertEquals("FAILED", runOnce(
                "{\"summary\":\"hi\",\"keyPoints\":[\"a\",\"b\",\"c\"]}").getStatus());
    }

    @Test void malformedJsonMarksFailed() {
        assertEquals("FAILED", runOnce("nope").getStatus());
    }

    @Test void emptyKeyPointsMarksFailed() {
        assertEquals("FAILED", runOnce(
                "{\"summary\":\"A reasonably long summary text that exceeds the minimum length here.\",\"keyPoints\":[]}").getStatus());
    }
}
