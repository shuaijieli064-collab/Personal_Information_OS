package com.signal.ai;

import java.util.List;

/** Vendor-agnostic embeddings. */
public interface EmbeddingProvider {
    List<Double> embed(String text);
    String model();
}
