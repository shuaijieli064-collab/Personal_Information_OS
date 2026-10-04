package com.signal.understanding.service;

import java.util.Map;

/** Pure, deterministic weighted scorer. No randomness. */
public final class SignalScoreCalculator {

    public record Factors(double relevance, double goalAlignment, double quality,
                          double urgency, double novelty, double interest, double reliability) {}

    public record Result(double score, Map<String, Double> factors) {}

    private SignalScoreCalculator() {}

    public static Result score(Factors f) {
        double s = 0.25*f.relevance + 0.20*f.goalAlignment + 0.15*f.quality
                 + 0.15*f.urgency + 0.10*f.novelty + 0.10*f.interest + 0.05*f.reliability;
        s = Math.max(0, Math.min(100, s));
        Map<String, Double> m = Map.of(
                "relevance", f.relevance, "goalAlignment", f.goalAlignment,
                "quality", f.quality, "urgency", f.urgency, "novelty", f.novelty,
                "interest", f.interest, "reliability", f.reliability);
        return new Result(Math.round(s * 10) / 10.0, m);
    }
}
