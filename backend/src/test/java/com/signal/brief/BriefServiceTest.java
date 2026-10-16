package com.signal.brief;

import com.signal.ai.AIProvider;
import com.signal.brief.dto.NotificationDto;
import com.signal.brief.entity.Notification;
import com.signal.brief.repository.NotificationRepository;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * The brief always has a body: a healthy model is used, and an outage degrades to the
 * deterministic counts + top-signal-titles rendering. No DB, no network.
 */
class BriefServiceTest {

    static class FakeAI implements AIProvider {
        String answer = "Synthesised brief.";
        boolean fail = false;

        @Override public String chat(ChatRequest request) {
            if (fail) throw new RuntimeException("llm down");
            return answer;
        }
        @Override public String structuredOutput(ChatRequest request) { return "{}"; }
        @Override public String name() { return "fake-ai"; }
    }

    private final SignalRepository signals = mock(SignalRepository.class);
    private final InformationRepository information = mock(InformationRepository.class);
    private final NotificationRepository notificationRepo = mock(NotificationRepository.class);
    private final FakeAI ai = new FakeAI();

    private final NotificationService notifications = new NotificationService(notificationRepo, signals);
    private final BriefService briefs = new BriefService(signals, information, notifications, ai, 10);

    private final UUID user = UUID.randomUUID();

    @BeforeEach
    void wire() {
        when(notificationRepo.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Signal signal(String title, double score, String status) {
        Signal s = new Signal();
        s.setId(UUID.randomUUID());
        s.setUserId(user);
        s.setTitle(title);
        s.setSignalScore(score);
        s.setStatus(status);
        return s;
    }

    private void topSignals(Signal... signalsList) {
        when(signals.findByUserIdOrderBySignalScoreDesc(eq(user), any()))
                .thenReturn(new PageImpl<>(List.of(signalsList)));
    }

    // ── happy path ──────────────────────────────────────────────────────────────

    @Test
    void generateUsesTheModelAndPersistsADailyBrief() {
        when(information.countByUserId(user)).thenReturn(12L);
        topSignals(signal("A", 90, "IMPORTANT"), signal("B", 80, "ACTIVE"));
        ai.answer = "Model brief.";

        NotificationDto dto = briefs.generate(user);

        assertEquals("Model brief.", dto.body());
        assertEquals(NotificationService.TYPE_DAILY_BRIEF, dto.type());
        assertEquals("Daily brief: 2 signals", dto.title());
        assertTrue(dto.payload().contains("\"actionRequired\":1"));
        assertTrue(dto.payload().contains("\"informationCount\":12"));
        verify(notificationRepo).save(any(Notification.class));
    }

    // ── degradation ─────────────────────────────────────────────────────────────

    @Test
    void modelFailureFallsBackToADeterministicBrief() {
        when(information.countByUserId(user)).thenReturn(12L);
        topSignals(signal("Alpha", 90, "ACTIVE"), signal("Beta", 80, "ACTIVE"));
        ai.fail = true;

        NotificationDto dto = assertDoesNotThrow(() -> briefs.generate(user));

        assertNotNull(dto.body());
        assertFalse(dto.body().isBlank(), "a brief is never empty because the LLM was down");
        assertTrue(dto.body().contains("2 signals"), dto.body());
        assertTrue(dto.body().contains("Top signals"), dto.body());
        assertTrue(dto.body().contains("Alpha"), dto.body());
    }

    @Test
    void aBlankModelAnswerAlsoFallsBack() {
        when(information.countByUserId(user)).thenReturn(1L);
        topSignals(signal("Alpha", 90, "ACTIVE"));
        ai.answer = "   ";

        NotificationDto dto = briefs.generate(user);

        assertTrue(dto.body().contains("Top signals"), dto.body());
    }

    @Test
    void noSignalsStillProducesAValidBrief() {
        when(information.countByUserId(user)).thenReturn(0L);
        topSignals();
        ai.fail = true;

        NotificationDto dto = briefs.generate(user);

        assertNotNull(dto.body());
        assertFalse(dto.body().isBlank());
        assertTrue(dto.body().contains("No signals yet"), dto.body());
    }

    // ── bounding / latest ───────────────────────────────────────────────────────

    @Test
    void theBriefIsBoundedByMaxSignals() {
        BriefService bounded = new BriefService(signals, information, notifications, ai, 2);
        when(information.countByUserId(user)).thenReturn(3L);
        topSignals(signal("A", 90, "ACTIVE"), signal("B", 80, "ACTIVE"), signal("C", 70, "ACTIVE"));
        ai.fail = true;

        String body = bounded.generate(user).body();

        assertTrue(body.contains("1. A"), body);
        assertTrue(body.contains("2. B"), body);
        assertFalse(body.contains("3. C"), "signals beyond max-signals are not listed");
    }

    @Test
    void latestReturnsTheMostRecentBriefOrNull() {
        when(notificationRepo.findFirstByUserIdAndTypeOrderByCreatedAtDesc(user, "DAILY_BRIEF"))
                .thenReturn(Optional.empty());
        assertNull(briefs.latest(user));

        Notification n = new Notification();
        n.setId(UUID.randomUUID());
        n.setUserId(user);
        n.setType("DAILY_BRIEF");
        n.setTitle("Daily brief: 1 signal");
        when(notificationRepo.findFirstByUserIdAndTypeOrderByCreatedAtDesc(user, "DAILY_BRIEF"))
                .thenReturn(Optional.of(n));

        NotificationDto dto = briefs.latest(user);
        assertNotNull(dto);
        assertEquals("Daily brief: 1 signal", dto.title());
    }
}
