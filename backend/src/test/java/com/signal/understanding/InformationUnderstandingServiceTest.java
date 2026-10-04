package com.signal.understanding;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.provider.InformationUnderstandingProvider;
import com.signal.understanding.provider.UnderstandingResult;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.InformationUnderstandingService;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InformationUnderstandingServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository repo = mock(InformationUnderstandingRepository.class);
    private final InformationUnderstandingProvider provider = (t, c) ->
            new UnderstandingResult("en", "article", "tech", "[]", "[]", "summary", "mock", "0.1");
    private final InformationUnderstandingService service =
            new InformationUnderstandingService(infoRepo, repo, provider);

    private final UUID user = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final UUID infoId = UUID.randomUUID();

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
}
