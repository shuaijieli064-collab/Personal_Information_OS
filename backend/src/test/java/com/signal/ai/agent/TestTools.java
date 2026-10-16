package com.signal.ai.agent;

import com.signal.ai.tools.AgentTool;
import com.signal.ai.tools.ToolPermission;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Reusable stubs for the agent tests — a configurable tool, and entity builders. */
final class TestTools {

    private TestTools() {}

    /** A tool whose outcome the test controls, recording how many times it ran. */
    static final class StubTool implements AgentTool {
        private final String name;
        private final ToolPermission permission;
        int calls = 0;
        boolean fail = false;
        Object result = Map.of("ok", true);
        Map<String, Object> lastArgs;

        StubTool(String name, ToolPermission permission) {
            this.name = name;
            this.permission = permission;
        }

        @Override public String name() { return name; }
        @Override public String description() { return "stub " + name; }
        @Override public ToolPermission permission() { return permission; }

        @Override public Map<String, String> parameters() {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("arg", "an argument");
            return p;
        }

        @Override public List<String> requiredParameters() { return List.of("arg"); }

        @Override public Object execute(UUID userId, Map<String, Object> args) {
            calls++;
            lastArgs = args;
            if (fail) throw new RuntimeException("boom");
            return result;
        }
    }

    static StubTool tool(String name, ToolPermission permission) {
        return new StubTool(name, permission);
    }

    static AgentStep step(int seq, String tool, ToolPermission permission, String argumentsJson) {
        AgentStep step = new AgentStep();
        step.setId(UUID.randomUUID());
        step.setSeq(seq);
        step.setToolName(tool);
        step.setPermission(permission.name());
        step.setArguments(argumentsJson);
        step.setStatus(AgentStepStatus.PLANNED.name());
        return step;
    }

    static AgentRun run() {
        AgentRun run = new AgentRun();
        run.setId(UUID.randomUUID());
        run.setUserId(UUID.randomUUID());
        run.setGoal("a goal");
        run.setStatus(AgentRunStatus.PLANNING.name());
        return run;
    }
}
