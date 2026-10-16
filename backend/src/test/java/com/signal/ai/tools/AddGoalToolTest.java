package com.signal.ai.tools;

import com.signal.goal.dto.GoalRequest;
import com.signal.goal.entity.Goal;
import com.signal.goal.service.GoalService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AddGoalToolTest {

    private final GoalService goals = mock(GoalService.class);
    private final AddGoalTool tool = new AddGoalTool(goals);

    @Test
    void permissionIsWrite() {
        assertEquals(ToolPermission.WRITE, tool.permission());
        assertEquals(List.of("title"), tool.requiredParameters());
    }

    @Test
    void missingTitleThrows() {
        assertThrows(ToolInvocationException.class, () -> tool.execute(UUID.randomUUID(), Map.of()));
    }

    @Test
    void delegatesToGoalService() throws Exception {
        UUID user = UUID.randomUUID();
        Goal goal = new Goal();
        goal.setTitle("Read more");
        goal.setDescription("about agents");
        when(goals.create(eq(user), any())).thenReturn(goal);

        Map<?, ?> out = (Map<?, ?>) tool.execute(user,
                Map.<String, Object>of("title", "Read more", "description", "about agents"));

        assertEquals("Read more", out.get("title"));
        assertEquals("about agents", out.get("description"));

        ArgumentCaptor<GoalRequest> captor = ArgumentCaptor.forClass(GoalRequest.class);
        verify(goals).create(eq(user), captor.capture());
        assertEquals("Read more", captor.getValue().title());
        assertEquals("about agents", captor.getValue().description());
    }
}
