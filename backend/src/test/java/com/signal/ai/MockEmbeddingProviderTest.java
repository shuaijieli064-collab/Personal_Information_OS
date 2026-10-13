package com.signal.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MockEmbeddingProviderTest {

    private static final int DIMENSIONS = AIProperties.DEFAULT_EMBEDDING_DIMENSIONS;

    private final MockEmbeddingProvider provider = new MockEmbeddingProvider();

    @Test void emitsConfiguredDimensions() {
        assertEquals(DIMENSIONS, provider.embed("Spring Boot 3.4 release").size());
    }

    @Test void unitLength() {
        List<Double> v = provider.embed("SIGNAL — Information is infinite. Attention is not.");
        double norm = Math.sqrt(v.stream().mapToDouble(x -> x * x).sum());
        assertEquals(1.0, norm, 1e-6);
    }

    @Test void identicalTextSimilarityOne() {
        String t = "Same release notes for Spring Boot 3.4";
        List<Double> a = provider.embed(t);
        List<Double> b = provider.embed(t);
        assertEquals(1.0, cosine(a, b), 1e-6);
    }

    @Test void differentTextsSimilarityBelowOne() {
        double sim = cosine(
                provider.embed("Kubernetes cluster autoscaling deep dive"),
                provider.embed("周末烘焙可颂的黄油层数研究"));
        assertTrue(sim < 0.99, "distinct texts must not be near-duplicates, got " + sim);
    }

    @Test void emptyInputYieldsValidUnitVector() {
        List<Double> v = provider.embed("");
        assertEquals(DIMENSIONS, v.size());
        double norm = Math.sqrt(v.stream().mapToDouble(x -> x * x).sum());
        assertEquals(1.0, norm, 1e-6);
    }

    @Test void nullInputYieldsValidUnitVector() {
        List<Double> v = provider.embed(null);
        assertEquals(DIMENSIONS, v.size());
        assertFalse(v.stream().allMatch(x -> x == 0.0));
    }

    @Test void modelLabelSignalsMock() {
        assertEquals("mock-embed-" + DIMENSIONS, provider.model());
    }

    private static double cosine(List<Double> a, List<Double> b) {
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.size(); i++) {
            dot += a.get(i) * b.get(i);
            na += a.get(i) * a.get(i);
            nb += b.get(i) * b.get(i);
        }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
    }
}
