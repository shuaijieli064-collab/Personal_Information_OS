package com.signal.ai.agent;

import com.signal.ai.tools.ToolPermission;
import com.signal.ai.tools.ToolRegistry;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AgentExecutorTest {

    private final TestTools.StubTool readTool = TestTools.tool("searchKnowledge", ToolPermission.READ);
    private final TestTools.StubTool writeTool = TestTools.tool("addGoal", ToolPermission.WRITE);
    private final TestTools.StubTool failingTool = TestTools.tool("flaky", ToolPermission.READ);
    private final ToolRegistry registry = new ToolRegistry(List.of(readTool, writeTool, failingTool));
    private final AgentExecutor executor = new AgentExecutor(registry);

    private final UUID user = UUID.randomUUID();

    // ── READ runs ───────────────────────────────────────────────────────────────

    @Test
    void readStepRunsImmediately() {
        AgentRun run = TestTools.run();
        AgentStep step = TestTools.step(1, "searchKnowledge", ToolPermission.READ, "{\"arg\":\"x\"}");
        List<AgentStep> steps = List.of(step);

        executor.execute(user, run, steps);

        assertEquals(AgentStepStatus.SUCCEEDED.name(), step.getStatus());
        assertNotNull(step.getResult());
        assertNotNull(step.getStartedAt());
        assertNotNull(step.getFinishedAt());
        assertNull(step.getError());
        assertEquals(1, readTool.calls);
        assertEquals("x", readTool.lastArgs.get("arg"), "arguments are parsed from the stored JSON");
        assertEquals(AgentRunStatus.RUNNING.name(), run.getStatus());
    }

    // ── WRITE pauses ────────────────────────────────────────────────────────────

    @Test
    void writeStepPausesTheRun() {
        AgentRun run = TestTools.run();
        AgentStep read = TestTools.step(1, "searchKnowledge", ToolPermission.READ, "{}");
        AgentStep write = TestTools.step(2, "addGoal", ToolPermission.WRITE, "{}");
        List<AgentStep> steps = List.of(read, write);

        executor.execute(user, run, steps);

        assertEquals(AgentStepStatus.SUCCEEDED.name(), read.getStatus());
        assertEquals(AgentStepStatus.PENDING_CONFIRMATION.name(), write.getStatus());
        assertEquals(AgentRunStatus.AWAITING_CONFIRMATION.name(), run.getStatus());
        assertEquals(0, writeTool.calls, "a WRITE step must not run before confirmation");
    }

    @Test
    void destructiveStepIsAlsoGated() {
        TestTools.StubTool destructive = TestTools.tool("wipe", ToolPermission.DESTRUCTIVE);
        AgentExecutor ex = new AgentExecutor(new ToolRegistry(List.of(destructive)));
        AgentRun run = TestTools.run();
        AgentStep step = TestTools.step(1, "wipe", ToolPermission.DESTRUCTIVE, "{}");

        ex.execute(user, run, List.of(step));

        assertEquals(AgentStepStatus.PENDING_CONFIRMATION.name(), step.getStatus());
        assertEquals(AgentRunStatus.AWAITING_CONFIRMATION.name(), run.getStatus());
        assertEquals(0, destructive.calls);
    }

    // ── confirm ─────────────────────────────────────────────────────────────────

    @Test
    void confirmExecutesThePendingStepAndContinues() {
        AgentRun run = TestTools.run();
        AgentStep write = TestTools.step(1, "addGoal", ToolPermission.WRITE, "{}");
        AgentStep read = TestTools.step(2, "searchKnowledge", ToolPermission.READ, "{}");
        List<AgentStep> steps = List.of(write, read);

        executor.execute(user, run, steps);
        assertEquals(AgentRunStatus.AWAITING_CONFIRMATION.name(), run.getStatus());

        executor.confirm(user, run, steps, write.getId());

        assertEquals(AgentStepStatus.SUCCEEDED.name(), write.getStatus());
        assertEquals(AgentStepStatus.SUCCEEDED.name(), read.getStatus());
        assertEquals(1, writeTool.calls);
        assertEquals(1, readTool.calls);
        assertEquals(AgentRunStatus.RUNNING.name(), run.getStatus());
    }

    @Test
    void confirmMayPauseAgainAtTheNextWriteStep() {
        AgentRun run = TestTools.run();
        AgentStep first = TestTools.step(1, "addGoal", ToolPermission.WRITE, "{}");
        AgentStep second = TestTools.step(2, "addGoal", ToolPermission.WRITE, "{}");
        List<AgentStep> steps = List.of(first, second);

        executor.execute(user, run, steps);
        executor.confirm(user, run, steps, first.getId());

        assertEquals(AgentStepStatus.SUCCEEDED.name(), first.getStatus());
        assertEquals(AgentStepStatus.PENDING_CONFIRMATION.name(), second.getStatus());
        assertEquals(AgentRunStatus.AWAITING_CONFIRMATION.name(), run.getStatus());
        assertEquals(1, writeTool.calls);
    }

    @Test
    void confirmOnARunThatIsNotAwaitingThrows() {
        AgentRun run = TestTools.run();
        AgentStep step = TestTools.step(1, "addGoal", ToolPermission.WRITE, "{}");
        // status is PLANNING, not AWAITING_CONFIRMATION
        assertThrows(IllegalArgumentException.class,
                () -> executor.confirm(user, run, List.of(step), step.getId()));
    }

    // ── reject ──────────────────────────────────────────────────────────────────

    @Test
    void rejectMarksTheStepAndRunRejected() {
        AgentRun run = TestTools.run();
        AgentStep write = TestTools.step(1, "addGoal", ToolPermission.WRITE, "{}");
        List<AgentStep> steps = List.of(write);

        executor.execute(user, run, steps);
        executor.reject(run, steps, null, "no thanks");

        assertEquals(AgentStepStatus.REJECTED.name(), write.getStatus());
        assertEquals(AgentRunStatus.REJECTED.name(), run.getStatus());
        assertEquals("no thanks", run.getError());
        assertEquals(0, writeTool.calls);
    }

    @Test
    void rejectOnARunThatIsNotAwaitingThrows() {
        AgentRun run = TestTools.run();
        AgentStep step = TestTools.step(1, "addGoal", ToolPermission.WRITE, "{}");
        assertThrows(IllegalArgumentException.class,
                () -> executor.reject(run, List.of(step), null, "why not"));
    }

    @Test
    void rejectWithoutAReasonStillExplainsTheRun() {
        AgentRun run = TestTools.run();
        AgentStep write = TestTools.step(1, "addGoal", ToolPermission.WRITE, "{}");
        List<AgentStep> steps = List.of(write);

        executor.execute(user, run, steps);
        executor.reject(run, steps, null, null);

        assertEquals(AgentRunStatus.REJECTED.name(), run.getStatus());
        assertNotNull(run.getError(), "a rejected run is never left without an answer or an error");
    }

    // ── failure handling ────────────────────────────────────────────────────────

    @Test
    void failingToolIsRetriedOnceThenRecordedAndTheRunContinues() {
        failingTool.fail = true;
        AgentRun run = TestTools.run();
        AgentStep bad = TestTools.step(1, "flaky", ToolPermission.READ, "{}");
        AgentStep good = TestTools.step(2, "searchKnowledge", ToolPermission.READ, "{}");
        List<AgentStep> steps = List.of(bad, good);

        assertDoesNotThrow(() -> executor.execute(user, run, steps));

        assertEquals(AgentStepStatus.FAILED.name(), bad.getStatus());
        assertEquals("boom", bad.getError());
        assertEquals(2, failingTool.calls, "the failing tool is attempted exactly twice (1 + retry)");
        assertEquals(AgentStepStatus.SUCCEEDED.name(), good.getStatus(), "the run continues past a failure");
        assertEquals(1, readTool.calls);
        assertEquals(AgentRunStatus.RUNNING.name(), run.getStatus());
    }

    @Test
    void toolFailingOnBothAttemptsDoesNotAbortTheRun() {
        failingTool.fail = true;
        AgentRun run = TestTools.run();
        AgentStep only = TestTools.step(1, "flaky", ToolPermission.READ, "{}");

        assertDoesNotThrow(() -> executor.execute(user, run, List.of(only)));

        assertEquals(AgentStepStatus.FAILED.name(), only.getStatus());
        assertEquals(2, failingTool.calls);
        assertNotEquals(AgentRunStatus.FAILED.name(), run.getStatus(),
                "one bad step must not fail the whole run");
    }

    @Test
    void unknownToolIsRecordedAsFailed() {
        AgentRun run = TestTools.run();
        AgentStep ghost = TestTools.step(1, "doesNotExist", ToolPermission.READ, "{}");

        assertDoesNotThrow(() -> executor.execute(user, run, List.of(ghost)));

        assertEquals(AgentStepStatus.FAILED.name(), ghost.getStatus());
        assertTrue(ghost.getError().contains("doesNotExist"));
    }
}
