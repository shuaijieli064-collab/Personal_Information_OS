package com.signal.goal;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.goal.dto.GoalRequest;
import com.signal.goal.entity.Goal;
import com.signal.goal.repository.GoalRepository;
import com.signal.goal.service.GoalService;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GoalServiceTest {

    final GoalRepository repo = mock(GoalRepository.class);
    final GoalService service = new GoalService(repo);

    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();
    UUID goalId = UUID.randomUUID();

    @Test
    void userACannotReadUserBGoal() {
        // repo only finds goals owned by the requesting user
        when(repo.findByIdAndUserId(goalId, a)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> service.get(a, goalId));
    }

    @Test
    void userACannotDeleteUserBGoal() {
        when(repo.findByIdAndUserId(goalId, a)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> service.delete(a, goalId));
        verify(repo, never()).delete(any());
    }

    @Test
    void ownerCanReadOwnGoal() {
        Goal g = new Goal();
        g.setUserId(a);
        when(repo.findByIdAndUserId(goalId, a)).thenReturn(Optional.of(g));
        assertSame(g, service.get(a, goalId));
    }

    @Test
    void createBindsToCurrentUser() {
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        Goal g = service.create(a, new GoalRequest("Learn concurrency", null, 5));
        assertEquals(a, g.getUserId());
        assertEquals(5, g.getPriority());
    }
}
