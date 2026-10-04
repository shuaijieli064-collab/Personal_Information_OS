package com.signal.understanding;

import com.signal.ai.AIProvider;
import com.signal.ai.ChatMessage;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.ClassificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClassificationServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository repo = mock(InformationUnderstandingRepository.class);

    private ClassificationService svc(String aiResponse) {
        AIProvider ai = new AIProvider() {
            public String chat(ChatRequest r) { return aiResponse; }
            public String structuredOutput(ChatRequest r) { return aiResponse; }
            public String name() { return "stub"; }
        };
        return new ClassificationService(infoRepo, repo, ai);
    }

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID());
        i.setUserId(UUID.randomUUID());
        i.setTitle("New Java virtual threads");
        i.setContent("A long technical article about concurrency.");
        return i;
    }

    private InformationUnderstanding runOnce(String aiResponse) {
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(info()));
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));
        svc(aiResponse).classify(UUID.randomUUID(), UUID.randomUUID());
        ArgumentCaptor<InformationUnderstanding> cap = ArgumentCaptor.forClass(InformationUnderstanding.class);
        verify(repo).save(cap.capture());
        return cap.getValue();
    }

    @Test void normalArticleClassified() {
        InformationUnderstanding r = runOnce("{\"classification\":\"TECHNOLOGY\",\"confidence\":0.92}");
        assertEquals("TECHNOLOGY", r.getClassification());
        assertEquals(0.92, r.getConfidence(), 0.001);
        assertEquals("COMPLETED", r.getStatus());
    }

    @Test void invalidClassificationMarksFailed() {
        InformationUnderstanding r = runOnce("{\"classification\":\"BOGUS\",\"confidence\":0.5}");
        assertEquals("FAILED", r.getStatus());
    }

    @Test void malformedJsonMarksFailed() {
        assertEquals("FAILED", runOnce("not json").getStatus());
    }

    @Test void confidenceOutOfRangeMarksFailed() {
        assertEquals("FAILED", runOnce("{\"classification\":\"NEWS\",\"confidence\":1.5}").getStatus());
    }
}
