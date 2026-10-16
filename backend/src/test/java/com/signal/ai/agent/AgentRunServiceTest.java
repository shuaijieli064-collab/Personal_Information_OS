package com.signal.ai.agent;

import com.signal.ai.AIProvider;
import com.signal.ai.agent.dto.RunDto;
import com.signal.ai.tools.ToolPermission;
import com.signal.ai.tools.ToolRegistry;
import com.signal.common.exceptions.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Exercises the service with the <b>real</b> executor and a real registry of stub tools,
 * mocking only the planner, the repositories and the LLM. That keeps the state machine
 * honest end to end (no DB, no network).
 */
class AgentRunServiceTest {

    static class FakeAI implements AIProvider {
        String answer = "Synthesised answer.";
        boolean fail = false;
        ChatRequest seen;

        @Override public String chat(ChatRequest request) {
            seen = request;
            if (fail) throw new RuntimeException("llm down");
            return answer;
        }

        @Override public String structuredOutput(ChatRequest request) { return "{}"; }

        @Override public String name() { return "fake-ai"; }
    }

    private final AgentPlanner planner = mock(AgentPlanner.class);
    private final AgentRunRepository runs = mock(AgentRunRepository.class);
    private final AgentStepRepository steps = mock(AgentStepRepository.class);
    private final FakeAI ai = new FakeAI();

    private final TestTools.StubTool ask = TestTools.tool("askKnowledge", ToolPermission.READ);
    private final TestTools.StubTool addGoal = TestTools.tool("addGoal", ToolPermission.WRITE);
    private final ToolRegistry registry = new ToolRegistry(List.of(ask, addGoal));
    private final AgentExecutor executor = new AgentExecutor(registry);

    private final AgentRunService service =
            new AgentRunService(planner, executor, runs, steps, registry, ai, 6);

    private final UUID userId = UUID.randomUUID();
    private final List<AgentStep> savedSteps = new ArrayList<>();
    private AgentRun savedRun;

    @BeforeEach
    void wireRepositories() {
        when(runs.save(any(AgentRun.class))).thenAnswer(inv -> {
            AgentRun run = inv.getArgument(0);
            if (run.getId() == null) run.setId(UUID.randomUUID());
            savedRun = run;
            return run;
        });
        when(steps.saveAll(anyList())).thenAnswer(inv -> {
            List<AgentStep> list = new ArrayList<>(inv.getArgument(0));
            savedSteps.clear();
            savedSteps.addAll(list);
            return list;
        });
        // Return a copy: the service may save the very list it just read, and clearing the
        // backing list in saveAll would otherwise wipe the argument it was handed.
        when(steps.findByRunIdOrderBySeqAsc(any())).thenAnswer(inv -> new ArrayList<>(savedSteps));
    }

    private void plannerReturns(AgentPlanner.PlannedStep... planned) {
        when(planner.plan(any(), anyInt())).thenReturn(new AgentPlanner.Plan(List.of(planned)));
    }

    // ── happy path ──────────────────────────────────────────────────────────────

    @Test
    void happyPathEndsCompletedWithAnAnswer() {
        plannerReturns(new AgentPlanner.PlannedStep("askKnowledge", Map.of("question", "hi"), "why"));
        ai.answer = "Here is your answer.";

        RunDto dto = service.createRun(userId, "hi", null);

        assertEquals("COMPLETED", dto.status());
        assertEquals("Here is your answer.", dto.answer());
        assertEquals("fake-ai", dto.model());
        assertEquals(1, dto.steps().size());
        assertEquals("askKnowledge", dto.steps().get(0).tool());
        assertEquals("SUCCEEDED", dto.steps().get(0).status());
        assertEquals(1, ask.calls);
    }

    @Test
    void answerSynthesisFailureFallsBackToDeterministicRendering() {
        plannerReturns(new AgentPlanner.PlannedStep("askKnowledge", Map.of("question", "hi"), "why"));
        ai.fail = true;

        RunDto dto = service.createRun(userId, "hi", null);

        assertEquals("COMPLETED", dto.status());
        assertNotNull(dto.answer());
        assertTrue(dto.answer().startsWith("Ran 1 tool"), dto.answer());
        assertTrue(dto.answer().contains("askKnowledge"), dto.answer());
    }

    // ── pause / confirm / reject ────────────────────────────────────────────────

    @Test
    void writeStepPausesTheRunWithoutAnAnswer() {
        plannerReturns(new AgentPlanner.PlannedStep("addGoal", Map.of("title", "Read more"), "why"));

        RunDto dto = service.createRun(userId, "add a goal", null);

        assertEquals("AWAITING_CONFIRMATION", dto.status());
        assertNull(dto.answer());
        assertEquals("PENDING_CONFIRMATION", dto.steps().get(0).status());
        assertEquals(0, addGoal.calls);
    }

    @Test
    void confirmContinuesAndCompletes() {
        plannerReturns(new AgentPlanner.PlannedStep("addGoal", Map.of("title", "Read more"), "why"));
        RunDto created = service.createRun(userId, "add a goal", null);
        assertEquals("AWAITING_CONFIRMATION", created.status());

        when(runs.findByIdAndUserId(eq(created.id()), eq(userId))).thenReturn(Optional.of(savedRun));

        RunDto confirmed = service.confirm(userId, created.id(), null, "go ahead");

        assertEquals("COMPLETED", confirmed.status());
        assertEquals("SUCCEEDED", confirmed.steps().get(0).status());
        assertEquals(1, addGoal.calls);
    }

    @Test
    void rejectMarksTheRunRejected() {
        plannerReturns(new AgentPlanner.PlannedStep("addGoal", Map.of("title", "Read more"), "why"));
        RunDto created = service.createRun(userId, "add a goal", null);

        when(runs.findByIdAndUserId(eq(created.id()), eq(userId))).thenReturn(Optional.of(savedRun));

        RunDto rejected = service.reject(userId, created.id(), "no thanks");

        assertEquals("REJECTED", rejected.status());
        assertEquals("REJECTED", rejected.steps().get(0).status());
        assertEquals("no thanks", rejected.error());
    }

    // ── user isolation ──────────────────────────────────────────────────────────

    @Test
    void anotherUsersRunIsNotFound() {
        when(runs.findByIdAndUserId(any(), eq(userId))).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.getRun(userId, UUID.randomUUID()));
    }

    @Test
    void getRunReturnsTheStoredSteps() {
        plannerReturns(new AgentPlanner.PlannedStep("askKnowledge", Map.of("question", "hi"), "why"));
        RunDto created = service.createRun(userId, "hi", null);
        when(runs.findByIdAndUserId(eq(created.id()), eq(userId))).thenReturn(Optional.of(savedRun));

        RunDto fetched = service.getRun(userId, created.id());

        assertEquals("COMPLETED", fetched.status());
        assertEquals(1, fetched.steps().size());
        assertEquals("askKnowledge", fetched.steps().get(0).tool());
    }

    // ── step budget ─────────────────────────────────────────────────────────────

    @Test
    void maxStepsIsClampedToOneToTen() {
        assertEquals(6, service.clampSteps(null));
        assertEquals(1, service.clampSteps(0));
        assertEquals(1, service.clampSteps(-5));
        assertEquals(10, service.clampSteps(50));
        assertEquals(3, service.clampSteps(3));
    }

    @Test
    void requestedStepCapIsPassedToThePlanner() {
        plannerReturns(new AgentPlanner.PlannedStep("askKnowledge", Map.of("question", "hi"), "why"));

        service.createRun(userId, "hi", 3);

        verify(planner).plan("hi", 3);
    }
}
