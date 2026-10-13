package com.signal.ai;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OpenAICompatibleEmbeddingProviderTest {

    private static final int DIMENSIONS = AIProperties.DEFAULT_EMBEDDING_DIMENSIONS;

    private static byte[] bytes(String s) { return s.getBytes(StandardCharsets.UTF_8); }

    @Test void parsesEmbeddingPayload() throws Exception {
        double[] dims = new double[DIMENSIONS];
        for (int i = 0; i < DIMENSIONS; i++) dims[i] = i * 0.001;
        String body = new ObjectMapper().writeValueAsString(
                java.util.Map.of("data", List.of(java.util.Map.of("embedding", dims))));
        List<Double> out = OpenAICompatibleEmbeddingProvider.parseEmbedding(bytes(body), DIMENSIONS);
        assertEquals(DIMENSIONS, out.size());
        assertEquals(0.0, out.get(0), 1e-9);
        assertEquals((DIMENSIONS - 1) * 0.001, out.get(DIMENSIONS - 1), 1e-9);
    }

    @Test void rejectsWrongDimensionality() {
        String body = "{\"data\":[{\"embedding\":[0.1,0.2,0.3]}]}";
        var ex = assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> OpenAICompatibleEmbeddingProvider.parseEmbedding(bytes(body), DIMENSIONS));
        assertTrue(ex.getMessage().contains("dim mismatch"));
    }

    @Test void rejectsMissingEmbeddingField() {
        String body = "{\"data\":[]}";
        assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> OpenAICompatibleEmbeddingProvider.parseEmbedding(bytes(body), DIMENSIONS));
    }
}
