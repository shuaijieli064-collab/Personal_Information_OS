package com.signal.interest;

import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.interest.dto.InterestRequest;
import com.signal.interest.repository.InterestRepository;
import com.signal.interest.service.InterestService;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class InterestServiceTest {

    final InterestRepository repo = mock(InterestRepository.class);
    final InterestService service = new InterestService(repo);
    final UUID user = UUID.randomUUID();

    @Test
    void normalizationTreatsAiAndAIAsSame() {
        when(repo.existsByUserIdAndNormalizedName(user, "ai")).thenReturn(true);
        assertThrows(DuplicateResourceException.class,
                () -> service.create(user, new InterestRequest("AI", 4)));
        assertThrows(DuplicateResourceException.class,
                () -> service.create(user, new InterestRequest("  ai ", 4)));
    }

    @Test
    void createSavesNormalizedName() {
        when(repo.existsByUserIdAndNormalizedName(any(), any())).thenReturn(false);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        var saved = service.create(user, new InterestRequest("  Java  ", 3));
        assertEquals("java", saved.getNormalizedName());
        verify(repo).existsByUserIdAndNormalizedName(eq(user), eq("java"));
    }
}
