package com.signal.signal;

import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import com.signal.signal.service.SignalGenerationService;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SignalGenerationServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository undRepo = mock(InformationUnderstandingRepository.class);
    private final SignalRepository signalRepo = mock(SignalRepository.class);

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID()); i.setUserId(UUID.randomUUID());
        i.setTitle("t"); i.setExcerpt("e");
        return i;
    }

    private SignalGenerationService svc(double rel) {
        InformationUnderstanding und = new InformationUnderstanding();
        und.setInformationId(UUID.randomUUID());
        und.setRelevanceScore(rel);
        und.setWhyRelevant("Matches your interest.");
        when(undRepo.findByInformationId(any())).thenReturn(Optional.of(und));
        return new SignalGenerationService(infoRepo, undRepo, signalRepo, 70);
    }

    @Test void belowThresholdNoSignal() {
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(info()));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);
        when(signalRepo.save(any())).thenAnswer(a -> a.getArgument(0));
        assertNull(svc(10).generate(UUID.randomUUID(), UUID.randomUUID()));
    }

    @Test void aboveThresholdCreatesSignal() {
        Information i = info();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(false);
        when(signalRepo.save(any())).thenAnswer(a -> a.getArgument(0));
        Signal s = svc(95).generate(UUID.randomUUID(), i.getId());
        assertNotNull(s);
        assertTrue(s.getSignalScore() >= 70);
    }

    @Test void duplicateRejected() {
        Information i = info();
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(signalRepo.existsByInformationId(any())).thenReturn(true);
        assertThrows(IllegalStateException.class,
                () -> svc(95).generate(UUID.randomUUID(), i.getId()));
    }
}
