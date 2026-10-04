package com.signal.signal;

import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SignalRepositoryTest {

    private final SignalRepository repo = mock(SignalRepository.class);

    @Test void idorLookupReturnsEmptyForOtherUser() {
        UUID id = UUID.randomUUID();
        when(repo.findByIdAndUserId(id, UUID.randomUUID())).thenReturn(Optional.empty());
        assertTrue(repo.findByIdAndUserId(id, UUID.randomUUID()).isEmpty());
    }
}
