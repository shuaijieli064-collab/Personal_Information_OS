package com.signal.understanding;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.service.SignalGenerationService;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.provider.InformationUnderstandingProvider;
import com.signal.understanding.provider.UnderstandingResult;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.InformationUnderstandingService;
import com.signal.understanding.service.RelevanceService;
import com.signal.understanding.service.RelevanceService.Relevance;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class InformationUnderstandingServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository repo = mock(InformationUnderstandingRepository.class);
    private final RelevanceService relevanceService = mock(RelevanceService.class);
    private final SignalGenerationService signalService = mock(SignalGenerationService.class);
    private final PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);

    private InformationUnderstandingProvider provider = (t, c) ->
            new UnderstandingResult("en", "article", "tech", "[]", "[]", "summary", "mock", "0.1");

    private final InformationUnderstandingService service =
            new InformationUnderstandingService(infoRepo, repo, provider,
                    relevanceService, signalService, txManager);

    private final UUID user = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final UUID infoId = UUID.randomUUID();

    @BeforeEach
    void stubTransactionsAndRelevance() {
        when(txManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        when(relevanceService.compute(any(), anyString(), any()))
                .thenReturn(new Relevance(60, true, 1, "Matches your goal: Java"));
    }

    private Information ownedInfo() {
        Information i = new Information();
        i.setUserId(user);
        i.setTitle("t");
        i.setContent("c");
        return i;
    }

    @Test
    void processCreatesCompletedRow() {
        when(infoRepo.findByIdAndUserId(infoId, user)).thenReturn(Optional.of(ownedInfo()));
        when(repo.findByInformationId(infoId)).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));

        InformationUnderstanding r = service.process(user, infoId);
        assertEquals("COMPLETED", r.getStatus());
        assertEquals("summary", r.getSummary());
        assertNotNull(r.getProcessedAt());
    }

    @Test
    void idorRejectsOtherUsersInformation() {
        when(infoRepo.findByIdAndUserId(infoId, other)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.process(other, infoId));
        verify(repo, never()).save(any());
        verifyNoInteractions(signalService);
    }

    @Test
    void duplicateInformationUpdatesSameRow() {
        when(infoRepo.findByIdAndUserId(infoId, user)).thenReturn(Optional.of(ownedInfo()));
        InformationUnderstanding existing = new InformationUnderstanding();
        existing.setInformationId(infoId);
        when(repo.findByInformationId(infoId)).thenReturn(Optional.of(existing));
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));

        InformationUnderstanding r = service.process(user, infoId);
        assertEquals(infoId, r.getInformationId());
        assertEquals("COMPLETED", r.getStatus());
    }

    @Test
    void pipelineComputesRelevanceAndGeneratesSignal() {
        when(infoRepo.findByIdAndUserId(infoId, user)).thenReturn(Optional.of(ownedInfo()));
        when(repo.findByInformationId(infoId)).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));

        service.process(user, infoId);

        verify(relevanceService, times(1)).compute(eq(user), anyString(), any());
        verify(relevanceService, times(1)).persist(eq(infoId), any(Relevance.class));
        verify(signalService, times(1)).generate(eq(user), eq(infoId), any(Relevance.class));
    }

    @Test
    void providerFailureMarksRowFailed() {
        InformationUnderstandingProvider boom = (t, c) -> { throw new IllegalStateException("provider down"); };
        InformationUnderstandingService failing =
                new InformationUnderstandingService(infoRepo, repo, boom,
                        relevanceService, signalService, txManager);

        when(infoRepo.findByIdAndUserId(infoId, user)).thenReturn(Optional.of(ownedInfo()));
        when(repo.findByInformationId(infoId)).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));

        assertThrows(IllegalStateException.class, () -> failing.process(user, infoId));

        ArgumentCaptor<InformationUnderstanding> cap =
                ArgumentCaptor.forClass(InformationUnderstanding.class);
        verify(repo, atLeastOnce()).save(cap.capture());
        assertEquals("FAILED", cap.getValue().getStatus());
        verify(signalService, never()).generate(any(), any(), any());
        verifyNoInteractions(relevanceService);
    }
}
