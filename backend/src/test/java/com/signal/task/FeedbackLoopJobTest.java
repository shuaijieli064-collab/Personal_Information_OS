package com.signal.task;

import com.signal.signal.entity.Signal;
import com.signal.signal.entity.UserFeedback;
import com.signal.signal.repository.SignalRepository;
import com.signal.signal.repository.UserFeedbackRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The bounded feedback adjustment: raising / lowering types move the score by a fixed
 * delta through {@code SignalScoreCalculator.adjust} (clamped to [0, 100]), and a signal
 * with no feedback row is never touched.
 */
class FeedbackLoopJobTest {

    private final UserFeedbackRepository feedback = mock(UserFeedbackRepository.class);
    private final SignalRepository signals = mock(SignalRepository.class);
    private final FeedbackLoopJob job = new FeedbackLoopJob(feedback, signals);

    private final UUID user = UUID.randomUUID();

    private Signal signal(UUID id, Double score) {
        Signal s = new Signal();
        s.setId(id);
        s.setUserId(user);
        s.setSignalScore(score);
        return s;
    }

    private UserFeedback fb(UUID signalId, String type) {
        UserFeedback f = new UserFeedback();
        f.setUserId(user);
        f.setSignalId(signalId);
        f.setType(type);
        return f;
    }

    /** Runs one feedback row against one signal and returns the resulting score. */
    private double scoreAfter(String type, double startingScore) {
        Signal s = signal(UUID.randomUUID(), startingScore);
        when(feedback.findByUserId(user)).thenReturn(List.of(fb(s.getId(), type)));
        when(signals.findByIdAndUserId(s.getId(), user)).thenReturn(Optional.of(s));
        job.run(user);
        return s.getSignalScore();
    }

    // ── raising feedback ────────────────────────────────────────────────────────

    @Test
    void usefulRaisesTheScore() {
        assertEquals(55.0, scoreAfter("USEFUL", 50.0), 0.001);
    }

    @Test
    void importantRaisesTheScoreMore() {
        assertEquals(58.0, scoreAfter("IMPORTANT", 50.0), 0.001);
    }

    @Test
    void saveRaisesTheScore() {
        assertEquals(56.0, scoreAfter("SAVE", 50.0), 0.001);
    }

    // ── lowering feedback ───────────────────────────────────────────────────────

    @Test
    void notUsefulLowersTheScore() {
        assertEquals(42.0, scoreAfter("NOT_USEFUL", 50.0), 0.001);
    }

    @Test
    void ignoreLowersTheScoreMore() {
        assertEquals(40.0, scoreAfter("IGNORE", 50.0), 0.001);
    }

    // ── clamping ────────────────────────────────────────────────────────────────

    @Test
    void raisingIsClampedAtOneHundred() {
        assertEquals(100.0, scoreAfter("IMPORTANT", 99.0), 0.001);
    }

    @Test
    void loweringIsClampedAtZero() {
        assertEquals(0.0, scoreAfter("IGNORE", 4.0), 0.001);
    }

    // ── untouched signals ───────────────────────────────────────────────────────

    @Test
    void aSignalWithNoFeedbackIsUntouched() {
        Signal s = signal(UUID.randomUUID(), 50.0);
        when(feedback.findByUserId(user)).thenReturn(List.of());

        job.run(user);

        assertEquals(50.0, s.getSignalScore(), 0.001);
        verify(signals, never()).save(any());
    }

    @Test
    void aMissingSignalIsSkippedWithoutFailing() {
        when(feedback.findByUserId(user)).thenReturn(List.of(fb(UUID.randomUUID(), "USEFUL")));
        when(signals.findByIdAndUserId(any(), any())).thenReturn(Optional.empty());

        String detail = assertDoesNotThrow(() -> job.run(user));

        assertEquals("0 signals adjusted from feedback", detail);
        verify(signals, never()).save(any());
    }

    @Test
    void anUnknownFeedbackTypeIsIgnored() {
        assertNull(FeedbackLoopJob.deltaFor("SOMETHING_ELSE"));
        assertNull(FeedbackLoopJob.deltaFor(null));
    }

    @Test
    void detailCountsTheAdjustedSignals() {
        Signal a = signal(UUID.randomUUID(), 50.0);
        Signal b = signal(UUID.randomUUID(), 50.0);
        when(feedback.findByUserId(user)).thenReturn(List.of(fb(a.getId(), "USEFUL"), fb(b.getId(), "IGNORE")));
        when(signals.findByIdAndUserId(a.getId(), user)).thenReturn(Optional.of(a));
        when(signals.findByIdAndUserId(b.getId(), user)).thenReturn(Optional.of(b));

        assertEquals("2 signals adjusted from feedback", job.run(user));
    }
}
