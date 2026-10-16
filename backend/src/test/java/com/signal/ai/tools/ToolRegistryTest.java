package com.signal.ai.tools;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ToolRegistryTest {

    /** Minimal tool used to exercise the registry without pulling in any service. */
    static class FakeTool implements AgentTool {
        private final String name;
        private final ToolPermission permission;

        FakeTool(String name, ToolPermission permission) {
            this.name = name;
            this.permission = permission;
        }

        @Override public String name() { return name; }
        @Override public String description() { return "does " + name; }
        @Override public ToolPermission permission() { return permission; }

        @Override public Map<String, String> parameters() {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("q", "the query");
            return p;
        }

        @Override public List<String> requiredParameters() { return List.of("q"); }

        @Override public Object execute(UUID userId, Map<String, Object> args) { return Map.of("ok", true); }
    }

    @Test
    void duplicateNamesAreRejected() {
        assertThrows(IllegalStateException.class, () -> new ToolRegistry(List.of(
                new FakeTool("dup", ToolPermission.READ),
                new FakeTool("dup", ToolPermission.WRITE))));
    }

    @Test
    void describeIncludesEveryToolNameAndPermission() {
        ToolRegistry registry = new ToolRegistry(List.of(
                new FakeTool("alpha", ToolPermission.READ),
                new FakeTool("beta", ToolPermission.WRITE)));

        String described = registry.describe();
        assertTrue(described.contains("alpha"), described);
        assertTrue(described.contains("beta"), described);
        assertTrue(described.contains("READ"), described);
        assertTrue(described.contains("WRITE"), described);
        assertTrue(described.contains("params: q*: the query"), described);
    }

    @Test
    void unknownLookupIsEmpty() {
        ToolRegistry registry = new ToolRegistry(List.of(new FakeTool("alpha", ToolPermission.READ)));
        assertTrue(registry.find("nope").isEmpty());
        assertTrue(registry.find(null).isEmpty());
    }

    @Test
    void findReturnsTheRegisteredInstance() {
        FakeTool alpha = new FakeTool("alpha", ToolPermission.READ);
        ToolRegistry registry = new ToolRegistry(List.of(alpha));
        assertSame(alpha, registry.find("alpha").orElseThrow());
        assertEquals(1, registry.all().size());
    }
}
