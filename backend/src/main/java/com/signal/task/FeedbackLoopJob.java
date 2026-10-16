package com.signal.task;

import com.signal.signal.entity.Signal;
import com.signal.signal.entity.UserFeedback;
import com.signal.signal.repository.SignalRepository;
import com.signal.signal.repository.UserFeedbackRepository;
import com.signal.understanding.service.SignalScoreCalculator;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The automated feedback loop: reads the user's {@link UserFeedback} and nudges the
 * matching signals' scores, then persists.
 *
 * <p><b>Formula</b> — a fixed, documented delta per feedback type, applied through
 * {@link SignalScoreCalculator#adjust} so it is clamped to the scorer's
 * {@code [0, 100]} range and rounded to one decimal (the same grid every other producer
 * uses). Raises are deliberately smaller than lowers: one "useful" must not pin an item
 * to 100, while a clear "ignore" should move it down meaningfully.
 *
 * <p>Signals with no feedback row, or whose score is not yet set, are left untouched.
 * The clamp is what keeps repeated runs bounded rather than drifting without limit.
 */
@Component
public class FeedbackLoopJob {

    // Feedback type → score delta. Raising: USEFUL +5, SAVE +6, IMPORTANT +8.
    static final double RAISE_USEFUL = 5;
    static final double RAISE_SAVE = 6;
    static final double RAISE_IMPORTANT = 8;
    // Lowering: NOT_USEFUL −8, IGNORE −10.
    static final double LOWER_NOT_USEFUL = 8;
    static final double LOWER_IGNORE = 10;

    private final UserFeedbackRepository feedback;
    private final SignalRepository signals;

    public FeedbackLoopJob(UserFeedbackRepository feedback, SignalRepository signals) {
        this.feedback = feedback;
        this.signals = signals;
    }

    /** Applies every feedback row for the user; returns how many signals changed. */
    public String run(UUID userId) {
        List<UserFeedback> rows = feedback.findByUserId(userId);
        int adjusted = 0;
        for (UserFeedback f : rows) {
            Double delta = deltaFor(f.getType());
            if (delta == null) continue;
            Signal signal = signals.findByIdAndUserId(f.getSignalId(), userId).orElse(null);
            if (signal == null || signal.getSignalScore() == null) continue;
            signal.setSignalScore(SignalScoreCalculator.adjust(signal.getSignalScore(), delta));
            signal.setUpdatedAt(Instant.now());
            signals.save(signal);
            adjusted++;
        }
        return adjusted + (adjusted == 1 ? " signal adjusted" : " signals adjusted") + " from feedback";
    }

    /** The bounded adjustment for a feedback type; {@code null} for anything unrecognised. */
    static Double deltaFor(String type) {
        if (type == null) return null;
        return switch (type) {
            case "USEFUL" -> RAISE_USEFUL;
            case "SAVE" -> RAISE_SAVE;
            case "IMPORTANT" -> RAISE_IMPORTANT;
            case "NOT_USEFUL" -> -LOWER_NOT_USEFUL;
            case "IGNORE" -> -LOWER_IGNORE;
            default -> null;
        };
    }
}
