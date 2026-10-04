package com.signal.understanding;

import com.signal.ai.EmbeddingProvider;
import com.signal.understanding.service.SemanticDedupService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SemanticDedupServiceTest {

    private final EmbeddingProvider mock = new com.signal.ai.MockEmbeddingProvider();
    private final SemanticDedupService svc = new SemanticDedupService(mock, 0.85);

    @Test void identicalVectorIsSame() {
        List<Double> v = mock.embed("Same release notes for Spring Boot 3.4");
        assertTrue(svc.isSameEvent(v, "Same release notes for Spring Boot 3.4", "x"));
    }

    @Test void thresholdIsConfigurable() {
        assertEquals(0.85, svc.threshold(), 0.001);
    }

    @Test void nullCandidateNotMatched() {
        assertFalse(svc.isSameEvent(null, "a", "b"));
    }

    @Test void embeddingFailureReturnsEmpty() {
        EmbeddingProvider broken = new EmbeddingProvider() {
            public List<Double> embed(String t) { throw new RuntimeException("down"); }
            public String model() { return "broken"; }
        };
        SemanticDedupService s = new SemanticDedupService(broken, 0.85);
        assertTrue(s.embed("x").isEmpty());
    }
}
