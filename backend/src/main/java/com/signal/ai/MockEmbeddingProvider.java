package com.signal.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic stand-in for tests / no-key mode. Not a real embedding model.
 * Emits {@value #DIMENSIONS}-dim vectors (unigram + bigram hashing) so the schema
 * contract {@code vector(1024)} (V17) holds in Mock mode; mutual exclusion with the
 * real provider via the api-key conditions (never @Primary).
 */
@Component
@ConditionalOnExpression("'${ai.api-key:}' == '' && '${ai.embedding-api-key:}' == ''")
public class MockEmbeddingProvider implements EmbeddingProvider {

    static final int DIMENSIONS = AIProperties.DEFAULT_EMBEDDING_DIMENSIONS;

    @Override
    public List<Double> embed(String text) {
        double[] v = new double[DIMENSIONS];
        String t = text == null ? "" : text;
        for (int i = 0; i < t.length(); i++) {
            int c = t.charAt(i);
            v[Math.floorMod(c, DIMENSIONS)] += 1.0;
            if (i + 1 < t.length()) {
                v[Math.floorMod(c * 31 + t.charAt(i + 1), DIMENSIONS)] += 1.0;
            }
        }
        double norm = 0;
        for (double x : v) norm += x * x;
        norm = Math.sqrt(norm);
        if (norm < 1e-9) { // empty input → unit basis vector, never a zero vector
            v[0] = 1.0;
            norm = 1.0;
        }
        List<Double> out = new ArrayList<>(DIMENSIONS);
        for (double x : v) out.add(x / norm);
        return out;
    }

    @Override public String model() { return "mock-embed-" + DIMENSIONS; }
}
