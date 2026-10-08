package com.signal.ai;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OpenAICompatibleEmbeddingProviderTest {

    private static byte[] bytes(String s) { return s.getBytes(StandardCharsets.UTF_8); }

    @Test void parsesEmbeddingPayload() throws Exception {
        double[] dims = new double[384];
        for (int i = 0; i < 384; i++) dims[i] = i * 0.001;
        String body = new ObjectMapper().writeValueAsString(
                java.util.Map.of("data", List.of(java.util.Map.of("embedding", dims))));
        List<Double> out = OpenAICompatibleEmbeddingProvider.parseEmbedding(bytes(body));
        assertEquals(384, out.size());
        assertEquals(0.0, out.get(0), 1e-9);
        assertEquals(0.383, out.get(383), 1e-9);
    }

    @Test void rejectsWrongDimensionality() {
        String body = "{\"data\":[{\"embedding\":[0.1,0.2,0.3]}]}";
        var ex = assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> OpenAICompatibleEmbeddingProvider.parseEmbedding(bytes(body)));
        assertTrue(ex.getMessage().contains("dim mismatch"));
    }

    @Test void rejectsMissingEmbeddingField() {
        String body = "{\"data\":[]}";
        assertThrows(OpenAICompatibleProvider.AIException.class,
                () -> OpenAICompatibleEmbeddingProvider.parseEmbedding(bytes(body)));
    }
}
