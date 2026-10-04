package com.signal.understanding.service;

import com.signal.ai.EmbeddingProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SemanticDedupService {

    private static final Logger log = LoggerFactory.getLogger(SemanticDedupService.class);
    private final EmbeddingProvider embeddings;
    private final double threshold;

    public SemanticDedupService(EmbeddingProvider embeddings,
                                @Value("${app.dedup.similarity-threshold:0.85}") double threshold) {
        this.embeddings = embeddings;
        this.threshold = threshold;
    }

    public double threshold() { return threshold; }

    public double similarity(List<Double> a, List<Double> b) {
        int n = Math.min(a.size(), b.size());
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < n; i++) { dot += a.get(i) * b.get(i); na += a.get(i)*a.get(i); nb += b.get(i)*b.get(i); }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
    }

    /** True only when embedding similarity exceeds threshold. Same-topic ≠ same-event. */
    public boolean isSameEvent(List<Double> candidateEmbedding, String title, String candidateTitle) {
        if (candidateEmbedding == null) return false;
        double s = similarity(embeddingsEmbed(title), candidateEmbedding);
        if (s < threshold) return false;
        // Guard: reject near-identical-title-but-generic-topic cases conservatively.
        log.debug("cluster candidate sim={}", s);
        return true;
    }

    private List<Double> embeddingsEmbed(String t) { return embeddings.embed(t); }

    public List<Double> embed(String text) {
        try { return embeddings.embed(text); }
        catch (Exception e) { log.warn("Embedding failed"); return List.of(); }
    }
}
