package com.signal.ai.agent;

import com.signal.ai.tools.AgentTool;
import com.signal.ai.tools.ToolInvocationException;
import com.signal.ai.tools.ToolPermission;
import com.signal.ai.tools.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Runs a plan in order, enforcing the permission gate.
 *
 * <p>Rules:
 * <ul>
 *   <li>{@code READ} steps execute immediately.</li>
 *   <li>{@code WRITE} / {@code DESTRUCTIVE} steps are <b>not</b> executed — the step is
 *       marked {@code PENDING_CONFIRMATION} and the run stops at
 *       {@code AWAITING_CONFIRMATION} until the user confirms.</li>
 *   <li>A step that throws is retried once; a second failure records {@code FAILED} with
 *       the error and the run <b>continues</b> with the remaining steps (there is no
 *       dependency graph, so one bad step must not abort the run).</li>
 * </ul>
 *
 * <p>The executor mutates the in-memory {@link AgentRun} / {@link AgentStep} entities and
 * leaves persistence to {@link AgentRunService} — that keeps the state machine unit-testable
 * without a database.
 */
@Component
public class AgentExecutor {

    private static final Logger log = LoggerFactory.getLogger(AgentExecutor.class);

    /** A failing tool is attempted this many times in total (1 initial + 1 retry). */
    static final int MAX_ATTEMPTS = 2;

    private final ToolRegistry registry;

    public AgentExecutor(ToolRegistry registry) {
        this.registry = registry;
    }

    /** Executes the whole plan from the start. */
    public void execute(UUID userId, AgentRun run, List<AgentStep> steps) {
        runSteps(userId, run, steps, 0, false);
    }

    /**
     * Confirms the pending step and continues. The confirmed step is executed even though
     * its permission is WRITE; the run may pause again at the next gated step.
     */
    public void confirm(UUID userId, AgentRun run, List<AgentStep> steps, UUID stepId) {
        requireAwaiting(run);
        int index = pendingIndex(steps, stepId);
        if (index < 0) throw new IllegalArgumentException("No pending step to confirm");
        runSteps(userId, run, steps, index, true);
    }

    /** Rejects the pending step and the run. */
    public void reject(AgentRun run, List<AgentStep> steps, UUID stepId, String reason) {
        requireAwaiting(run);
        int index = pendingIndex(steps, stepId);
        if (index < 0) throw new IllegalArgumentException("No pending step to reject");

        AgentStep step = steps.get(index);
        step.setStatus(AgentStepStatus.REJECTED.name());
        step.setFinishedAt(Instant.now());

        String why = (reason == null || reason.isBlank()) ? null : reason.trim();
        if (why != null) step.setError(why);
        // A run is never left without either an answer or an error — a rejection explains itself.
        run.setError(why != null ? why : "Rejected by the user");
        run.setStatus(AgentRunStatus.REJECTED.name());
        run.setUpdatedAt(Instant.now());
    }

    // ── internals ───────────────────────────────────────────────────────────────

    private void runSteps(UUID userId, AgentRun run, List<AgentStep> steps, int fromIndex,
                          boolean firstIsConfirmed) {
        run.setStatus(AgentRunStatus.RUNNING.name());
        run.setUpdatedAt(Instant.now());

        for (int i = fromIndex; i < steps.size(); i++) {
            AgentStep step = steps.get(i);
            boolean confirmed = firstIsConfirmed && i == fromIndex;
            if (!confirmed && isGated(step)) {
                step.setStatus(AgentStepStatus.PENDING_CONFIRMATION.name());
                step.setFinishedAt(null);
                run.setStatus(AgentRunStatus.AWAITING_CONFIRMATION.name());
                run.setUpdatedAt(Instant.now());
                return;
            }
            executeStep(userId, step);
        }
    }

    /** Executes one step with a single retry; records the outcome on the step. */
    private void executeStep(UUID userId, AgentStep step) {
        step.setStatus(AgentStepStatus.RUNNING.name());
        step.setStartedAt(Instant.now());
        step.setError(null);

        Exception last = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                AgentTool tool = registry.find(step.getToolName())
                        .orElseThrow(() -> new ToolInvocationException("Unknown tool: " + step.getToolName()));
                Object result = tool.execute(userId, AgentJson.parseObject(step.getArguments()));
                step.setResult(AgentJson.toText(result));
                step.setError(null);
                step.setStatus(AgentStepStatus.SUCCEEDED.name());
                step.setFinishedAt(Instant.now());
                return;
            } catch (Exception e) {
                last = e;
                log.warn("Agent step failed tool={} attempt={}/{} err={}",
                        step.getToolName(), attempt, MAX_ATTEMPTS, e.toString());
            }
        }

        step.setStatus(AgentStepStatus.FAILED.name());
        step.setError(errorMessage(last));
        step.setFinishedAt(Instant.now());
    }

    /** A gated step changes state, so it needs the user's confirmation before running. */
    private static boolean isGated(AgentStep step) {
        return !ToolPermission.READ.name().equals(step.getPermission());
    }

    private static int pendingIndex(List<AgentStep> steps, UUID stepId) {
        for (int i = 0; i < steps.size(); i++) {
            AgentStep step = steps.get(i);
            if (!AgentStepStatus.PENDING_CONFIRMATION.name().equals(step.getStatus())) continue;
            if (stepId == null || stepId.equals(step.getId())) return i;
        }
        return -1;
    }

    private static void requireAwaiting(AgentRun run) {
        if (!AgentRunStatus.AWAITING_CONFIRMATION.name().equals(run.getStatus())) {
            // IllegalArgumentException (not IllegalState) so GlobalExceptionHandler maps it to 400.
            throw new IllegalArgumentException("Run is not awaiting confirmation");
        }
    }

    private static String errorMessage(Exception e) {
        if (e == null) return "Tool failed";
        String message = e.getMessage();
        return (message == null || message.isBlank()) ? e.toString() : message;
    }
}
