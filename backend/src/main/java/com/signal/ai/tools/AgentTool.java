package com.signal.ai.tools;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A single capability the agent may invoke. Implementations are Spring beans; the
 * {@link ToolRegistry} collects them and the planner is shown {@link ToolRegistry#describe()}.
 *
 * <p>Every implementation must be <b>user-scoped</b>: {@code userId} is the authenticated
 * caller and the tool may only touch that caller's rows. An id owned by someone else must
 * behave exactly like a missing id (never a leak).
 */
public interface AgentTool {

    /** camelCase, unique across the registry. */
    String name();

    /** One line, written for the planner prompt. */
    String description();

    ToolPermission permission();

    /** Parameter name → description, ordered as it should appear in the prompt. */
    Map<String, String> parameters();

    /** Subset of {@link #parameters()} that must be present. */
    List<String> requiredParameters();

    /**
     * Runs the tool for the calling user.
     *
     * @return a JSON-serialisable value (maps / lists / scalars)
     * @throws ToolInvocationException when the tool cannot run (unknown args, bad type, …)
     * @throws Exception               any downstream failure — the executor records it
     */
    Object execute(UUID userId, Map<String, Object> args) throws Exception;
}
