package com.signal.ai;

import org.springframework.stereotype.Component;

import java.util.List;

/** Deterministic stand-in for tests / no-key mode. Not a real embedding model. */
@Component
public class MockEmbeddingProvider implements EmbeddingProvider {

    @Override
    public List<Double> embed(String text) {
        double[] v = new double[8];
        if (text != null) {
            for (int i = 0; i < text.length(); i++) v[i % 8] += text.charAt(i);
        }
        double norm = 0;
        for (double x : v) norm += x * x;
        norm = Math.sqrt(norm) + 1e-9;
        List<Double> out = new java.util.ArrayList<>(v.length);
        for (double x : v) out.add(x / norm);
        return out;
    }

    @Override public String model() { return "mock-embed-8"; }
}
