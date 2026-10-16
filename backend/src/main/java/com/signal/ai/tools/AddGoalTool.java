package com.signal.ai.tools;

import com.signal.goal.dto.GoalRequest;
import com.signal.goal.entity.Goal;
import com.signal.goal.service.GoalService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** WRITE — creates a goal for the caller. */
@Component
public class AddGoalTool implements AgentTool {

    private final GoalService goals;

    public AddGoalTool(GoalService goals) {
        this.goals = goals;
    }

    @Override public String name() { return "addGoal"; }

    @Override public String description() {
        return "Create a new goal for the user.";
    }

    @Override public ToolPermission permission() { return ToolPermission.WRITE; }

    @Override public Map<String, String> parameters() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("title", "short goal title");
        p.put("description", "optional longer description");
        return p;
    }

    @Override public List<String> requiredParameters() { return List.of("title"); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        String title = ToolArgs.requiredString(args, "title");
        String description = ToolArgs.optionalString(args, "description");

        Goal goal = goals.create(userId, new GoalRequest(title, description, null));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", goal.getId());
        out.put("title", goal.getTitle());
        out.put("description", goal.getDescription());
        out.put("status", goal.getStatus());
        return out;
    }
}
