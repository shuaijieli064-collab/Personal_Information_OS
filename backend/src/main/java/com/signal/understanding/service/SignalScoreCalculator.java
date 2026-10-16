package com.signal.understanding.service;

import java.util.Map;

/** Pure, deterministic weighted scorer. No randomness. */
public final class SignalScoreCalculator {

    /** The score range every producer and consumer of a signal score agrees on. */
    public static final double MIN_SCORE = 0;
    public static final double MAX_SCORE = 100;

    public record Factors(double relevance, double goalAlignment, double quality,
                          double urgency, double novelty, double interest, double reliability) {}

    public record Result(double score, Map<String, Double> factors) {}

    private SignalScoreCalculator() {}

    public static Result score(Factors f) {
        double s = 0.25*f.relevance + 0.20*f.goalAlignment + 0.15*f.quality
                 + 0.15*f.urgency + 0.10*f.novelty + 0.10*f.interest + 0.05*f.reliability;
        Map<String, Double> m = Map.of(
                "relevance", f.relevance, "goalAlignment", f.goalAlignment,
                "quality", f.quality, "urgency", f.urgency, "novelty", f.novelty,
                "interest", f.interest, "reliability", f.reliability);
        return new Result(clamp(s), m);
    }

    /**
     * Clamps to [{@value #MIN_SCORE}, {@value #MAX_SCORE}] and rounds to one decimal —
     * the exact treatment {@link #score} applies, so any producer of a signal score
     * (including the Phase 8 feedback loop) lands on the same grid.
     */
    public static double clamp(double value) {
        double bounded = Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));
        return Math.round(bounded * 10) / 10.0;
    }

    /** Applies a bounded delta to an existing score, clamped to the scorer's range. */
    public static double adjust(double current, double delta) {
        return clamp(current + delta);
    }
}
