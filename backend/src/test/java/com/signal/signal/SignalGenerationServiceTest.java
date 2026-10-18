package com.signal.signal;

import com.signal.dedup.DuplicateSignalGuard;
import com.signal.dedup.InformationEmbeddingStore;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import com.signal.signal.service.SignalGenerationService;
import com.signal.signal.service.WhyItMattersService;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.RelevanceService.Relevance;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SignalGenerationServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository undRepo = mock(InformationUnderstandingRepository.class);
    private final SignalRepository signalRepo = mock(SignalRepository.class);
    private final WhyItMattersService whyItMatters = mock(WhyItMattersService.class);
    private final DuplicateSignalGuard dedup = mock(DuplicateSignalGuard.class);

    private final SignalGenerationService svc =
            new SignalGenerationService(infoRepo, undRepo, signalRepo, whyItMatters, dedup, 70);

    @BeforeEach
    void stubUnderstandingRow() {
        InformationUnderstanding und = new InformationUnderstanding();
        und.setInformationId(UUID.randomUUID());
        when(undRepo.findByInformationId(any())).thenReturn(Optional.of(und));
        when(undRepo.save(any())).thenAnswer(a -> a.getArgument(0));
        when(whyItMatters.generate(any(), any(), any(), any())).thenReturn("why");
        when(dedup.duplicateOf(any(), any())).thenReturn(Optional.empty());
    }

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID()); i.setUserId(UUID.randomUUID());
        i.setTitle("t"); i.setExcerpt("e");
        i.setPublishedAt(Instant.now());
        return i;
    }

    private Relevance rel(double score, boolean goalMatched, int interestMatches) {
        return new Relevance(score, goalMatched, interestMatches, null, java.util.List.of());
    }

    @Test void belowThresholdNoSignal() {
        Information i = info();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);
        assertNull(svc.generate(UUID.randomUUID(), i.getId(), rel(10, false, 0)));
        verify(signalRepo, never()).save(any());
    }

    @Test void aboveThresholdCreatesSignal() {
        Information i = info();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);
        when(signalRepo.save(any())).thenAnswer(a -> a.getArgument(0));

        Signal s = svc.generate(UUID.randomUUID(), i.getId(), rel(95, true, 1));
        assertNotNull(s);
        assertTrue(s.getSignalScore() >= 70);
        assertEquals(i.getId(), s.getInformationId());
    }

    /** Re-running the pipeline for an item that already has a Signal is a no-op. */
    @Test void duplicateIsIdempotentNoOp() {
        Information i = info();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(true);

        assertNull(svc.generate(UUID.randomUUID(), i.getId(), rel(95, true, 1)));
        verify(signalRepo, never()).save(any());
    }

    /** Score is always recorded on the understanding row, Signal or not. */
    @Test void scoreIsRecordedEvenWhenBelowThreshold() {
        Information i = info();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);

        svc.generate(UUID.randomUUID(), i.getId(), rel(10, false, 0));

        ArgumentCaptor<InformationUnderstanding> cap =
                ArgumentCaptor.forClass(InformationUnderstanding.class);
        verify(undRepo).save(cap.capture());
        assertNotNull(cap.getValue().getSignalScore());
        assertTrue(cap.getValue().getScoreFactors().contains("relevance"));
        verify(signalRepo, never()).save(any());
    }

    /** Fresh, complete, goal-matching content must clear the 70 threshold. */
    @Test void strongItemClearsThreshold() {
        Information i = info();
        i.setContent("x".repeat(1200));
        i.setAuthor("author");
        i.setUrl("https://example.com/a");
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);
        when(signalRepo.save(any())).thenAnswer(a -> a.getArgument(0));

        Signal s = svc.generate(UUID.randomUUID(), i.getId(), rel(70, true, 2));
        assertNotNull(s);
        assertTrue(s.getSignalScore() >= 70);
    }

    /**
     * Same event under a second URL: the item clears the threshold, but the user already has
     * this story. No second Signal — the duplicate is recorded as corroboration instead.
     */
    @Test void sameEventDoesNotCreateSecondSignal() {
        Information i = info();
        UUID anchorId = UUID.randomUUID();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);
        var match = new InformationEmbeddingStore.Match(anchorId, 0.93, "the same story");
        when(dedup.duplicateOf(any(), any())).thenReturn(Optional.of(match));

        assertNull(svc.generate(UUID.randomUUID(), i.getId(), rel(95, true, 1)));

        verify(signalRepo, never()).save(any());
        verify(dedup).corroborate(any(), eq(match), eq(i));
        // The score is still recorded: the user can see this item scored well and was
        // suppressed as a duplicate rather than falling below the bar.
        verify(undRepo).save(any());
    }
}
