package com.signal.understanding;

import com.signal.ai.AIProvider;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.TopicExtractionService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TopicExtractionServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository repo = mock(InformationUnderstandingRepository.class);

    private TopicExtractionService svc(String resp) {
        AIProvider ai = new AIProvider() {
            public String chat(ChatRequest r) { return resp; }
            public String structuredOutput(ChatRequest r) { return resp; }
            public String name() { return "stub"; }
        };
        return new TopicExtractionService(infoRepo, repo, ai);
    }

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID());
        i.setUserId(UUID.randomUUID());
        i.setTitle("t"); i.setContent("c");
        return i;
    }

    private InformationUnderstanding runOnce(String resp) {
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(info()));
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));
        svc(resp).extract(UUID.randomUUID(), UUID.randomUUID());
        ArgumentCaptor<InformationUnderstanding> cap = ArgumentCaptor.forClass(InformationUnderstanding.class);
        verify(repo).save(cap.capture());
        return cap.getValue();
    }

    @Test void duplicatesDeduplicated() {
        InformationUnderstanding r = runOnce(
                "{\"topics\":[\"Spring Boot\",\"spring boot\",\"SpringBoot\"],\"entities\":[]}");
        assertTrue(r.getTopics().contains("Spring Boot"));
        assertFalse(r.getTopics().contains("spring boot"));
    }

    @Test void malformedJsonMarksFailed() {
        assertEquals("FAILED", runOnce("nope").getStatus());
    }

    @Test void tooManyTopicsCapped() {
        StringBuilder b = new StringBuilder("{\"topics\":[");
        for (int i = 0; i < 20; i++) { b.append("\"T").append(i).append("\","); }
        b.append("\"X\"],\"entities\":[]}");
        InformationUnderstanding r = runOnce(b.toString());
        assertTrue(r.getTopics().split(",").length <= 10);
    }

    @Test void invalidEntityKindDropped() {
        InformationUnderstanding r = runOnce(
                "{\"topics\":[],\"entities\":[{\"name\":\"x\",\"kind\":\"MAGIC\"}]}");
        assertFalse(r.getEntities().contains("x"));
    }
}
