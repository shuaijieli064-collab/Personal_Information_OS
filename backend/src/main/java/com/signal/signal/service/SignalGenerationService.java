package com.signal.signal.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.dedup.DuplicateSignalGuard;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.RelevanceService.Relevance;
import com.signal.understanding.service.SignalScoreCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Turns an Information + its relevance into a Signal.
 *
 * <p>Every factor is derived from real inputs rather than fixed placeholders, so
 * different items actually score differently. The threshold (app.signal.min-score,
 * default 70) then decides whether the item becomes a Signal at all — the product
 * promise is a short list, not everything.
 */
@Service
public class SignalGenerationService {

    private static final Logger log = LoggerFactory.getLogger(SignalGenerationService.class);

    /** When nothing matches: goal alignment and personal interest sit at their floor. */
    private static final double GOAL_MISS = 25;
    private static final double GOAL_HIT = 90;
    private static final double INTEREST_MISS = 30;
    private static final double INTEREST_FLOOR = 75;
    private static final double INTEREST_STEP = 5;
    private static final double INTEREST_CAP = 95;

    private final InformationRepository infoRepo;
    private final InformationUnderstandingRepository undRepo;
    private final SignalRepository signalRepo;
    private final WhyItMattersService whyItMatters;
    private final DuplicateSignalGuard dedup;
    private final double minScore;
    private final ObjectMapper json = new ObjectMapper();

    public SignalGenerationService(InformationRepository infoRepo,
                                   InformationUnderstandingRepository undRepo,
                                   SignalRepository signalRepo,
                                   WhyItMattersService whyItMatters,
                                   DuplicateSignalGuard dedup,
                                   @Value("${app.signal.min-score:70}") double minScore) {
        this.infoRepo = infoRepo; this.undRepo = undRepo;
        this.signalRepo = signalRepo; this.whyItMatters = whyItMatters;
        this.dedup = dedup;
        this.minScore = minScore;
    }

    /**
     * The bar an item must clear to become a Signal. Exposed so the UI can say
     * "45.8, threshold 70" instead of showing a number with nothing to compare it to.
     */
    public double minScore() {
        return minScore;
    }

    /**
     * Computes the score without persisting a Signal. Used by the pipeline so a
     * below-threshold item still records its score on the understanding row.
     */
    public Scored score(UUID userId, UUID informationId, Relevance relevance) {
        Information info = infoRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
        return score(info, relevance);
    }

    /** Score + persist a Signal when the score clears the threshold; null otherwise.
     *  Idempotent: re-running the pipeline for an item that already produced a Signal
     *  (ingestion auto-understands, then a user can trigger understanding again) is a
     *  no-op instead of an error. */
    @Transactional
    public Signal generate(UUID userId, UUID informationId, Relevance relevance) {
        Information info = infoRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
        if (signalRepo.existsByInformationId(informationId)) {
            log.debug("Signal already exists for information={} — idempotent skip", informationId);
            return null;
        }

        Scored scored = score(info, relevance);
        recordScore(informationId, scored);

        if (scored.score() < minScore) {
            log.debug("Below threshold information={} score={} min={}",
                    informationId, scored.score(), minScore);
            return null;
        }

        // Same event, different URL: the item stays (two sources agreeing is corroboration),
        // but a second Signal would be the product telling the user the same thing twice.
        var anchor = dedup.duplicateOf(userId, info);
        if (anchor.isPresent()) {
            dedup.corroborate(userId, anchor.get(), info);
            log.info("Duplicate suppressed information={} anchor={} similarity={}",
                    informationId, anchor.get().informationId(), anchor.get().similarity());
            return null;
        }

        Signal s = new Signal();
        s.setUserId(userId);
        s.setInformationId(informationId);
        s.setTitle(info.getTitle());
        s.setSummary(scored.summary());
        s.setSignalScore(scored.score());
        // The reason is written by the model, in the user's language; null when it cannot
        // be — the UI omits the block rather than showing an untranslatable template.
        s.setWhyItMatters(whyItMatters.generate(info.getTitle(), scored.summary(),
                relevance.matchedGoal(), relevance.matchedInterests()));
        s.setUpdatedAt(Instant.now());
        return signalRepo.save(s);
    }

    private Scored score(Information info, Relevance relevance) {
        SignalScoreCalculator.Factors f = new SignalScoreCalculator.Factors(
                relevance.score(),
                relevance.goalMatched() ? GOAL_HIT : GOAL_MISS,
                quality(info),
                urgency(info),
                novelty(),
                interest(relevance),
                reliability(info));
        SignalScoreCalculator.Result r = SignalScoreCalculator.score(f);
        return new Scored(r.score(), r.factors(), summaryOf(info, relevance));
    }

    /** Content completeness — thin items score low, rich items score high. */
    private double quality(Information info) {
        double q = 40;
        String content = info.getContent();
        if (content != null && content.length() > 200) q += 25;
        if (content != null && content.length() > 1000) q += 10;
        if (notBlank(info.getExcerpt())) q += 10;
        if (notBlank(info.getAuthor())) q += 10;
        if (notBlank(info.getUrl())) q += 5;
        return Math.min(100, q);
    }

    /** Age decay — freshness is urgency. */
    private double urgency(Information info) {
        if (info.getPublishedAt() == null) return 50;
        long ageDays = Duration.between(info.getPublishedAt(), Instant.now()).toDays();
        if (ageDays < 0) return 90;   // scheduled/future item
        if (ageDays <= 1) return 95;
        if (ageDays <= 3) return 75;
        if (ageDays <= 7) return 55;
        if (ageDays <= 30) return 40;
        return 25;
    }

    /**
     * Every item that reaches this point is novel by construction: exact duplicates are
     * dropped at ingestion and same-event republished items are suppressed just above
     * (see {@link DuplicateSignalGuard}). Scoring therefore does not need a novelty penalty.
     */
    private double novelty() {
        return 80;
    }

    private double interest(Relevance relevance) {
        if (relevance.interestMatches() <= 0) return INTEREST_MISS;
        return Math.min(INTEREST_CAP, INTEREST_FLOOR + relevance.interestMatches() * INTEREST_STEP);
    }

    /** Source reliability proxy: a linkable, attributable item is more trustworthy. */
    private double reliability(Information info) {
        return notBlank(info.getUrl()) ? 75 : 60;
    }

    private String summaryOf(Information info, Relevance relevance) {
        String text = info.getExcerpt();
        if (notBlank(text)) return text;
        text = info.getContent();
        if (notBlank(text)) return text.length() > 240 ? text.substring(0, 240) + "…" : text;
        // No prose fallback from the relevance pass any more — its text was machine English.
        return info.getTitle();
    }

    /** Persists the computed score/factors onto the understanding row for observability. */
    private void recordScore(UUID informationId, Scored scored) {
        InformationUnderstanding row = undRepo.findByInformationId(informationId).orElse(null);
        if (row == null) return;
        row.setSignalScore(scored.score());
        row.setScoreFactors(toJson(scored.factors()));
        row.setUpdatedAt(Instant.now());
        undRepo.save(row);
    }

    private String toJson(java.util.Map<String, Double> factors) {
        try {
            return json.writeValueAsString(factors);
        } catch (Exception e) {
            log.warn("Could not serialize score factors: {}", e.getMessage());
            return "{}";
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    public record Scored(double score, java.util.Map<String, Double> factors, String summary) {}
}
