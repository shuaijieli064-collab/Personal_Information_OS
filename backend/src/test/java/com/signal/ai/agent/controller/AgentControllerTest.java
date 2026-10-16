package com.signal.ai.agent.controller;

import com.signal.ai.agent.AgentRunService;
import com.signal.ai.agent.dto.RunDto;
import com.signal.ai.agent.dto.RunPage;
import com.signal.ai.agent.dto.StepDto;
import com.signal.ai.tools.AgentTool;
import com.signal.ai.tools.ToolPermission;
import com.signal.ai.tools.ToolRegistry;
import com.signal.common.GlobalExceptionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Standalone MockMvc (no Spring context, no DB) covering the Phase 7 endpoint contract:
 * route wiring, principal → userId propagation, request validation and the 400 mapping
 * when a run is not awaiting confirmation.
 */
class AgentControllerTest {

    /** Minimal catalogue entry so the registry mock can return a real tool. */
    static class StubTool implements AgentTool {
        @Override public String name() { return "searchKnowledge"; }
        @Override public String description() { return "Search the knowledge base."; }
        @Override public ToolPermission permission() { return ToolPermission.READ; }
        @Override public Map<String, String> parameters() {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("query", "the search query");
            return p;
        }
        @Override public List<String> requiredParameters() { return List.of("query"); }
        @Override public Object execute(UUID userId, Map<String, Object> args) { return null; }
    }

    private final ToolRegistry registry = mock(ToolRegistry.class);
    private final AgentRunService runs = mock(AgentRunService.class);

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new AgentController(registry, runs))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    private final UUID userId = UUID.randomUUID();

    private void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static RunDto runDto(UUID id, String status, String answer, List<StepDto> steps) {
        Instant now = Instant.now();
        return new RunDto(id, "the goal", status, answer, "fake-ai", null, now, now, steps);
    }

    private static StepDto stepDto(UUID id) {
        return new StepDto(id, 1, "searchKnowledge", "READ", "SUCCEEDED",
                Map.of("query", "k8s"), Map.of("count", 2), "why", null,
                Instant.now(), Instant.now());
    }

    // ── tools ───────────────────────────────────────────────────────────────────

    @Test
    void toolsReturnsTheCatalogue() throws Exception {
        authenticate();
        when(registry.all()).thenReturn(List.of(new StubTool()));

        mockMvc.perform(get("/api/v1/agent/tools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.tools[0].name").value("searchKnowledge"))
                .andExpect(jsonPath("$.data.tools[0].permission").value("READ"))
                .andExpect(jsonPath("$.data.tools[0].required[0]").value("query"))
                .andExpect(jsonPath("$.data.tools[0].parameters.query").value("the search query"));
    }

    // ── create ──────────────────────────────────────────────────────────────────

    @Test
    void createRunReturnsTheRunDto() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        when(runs.createRun(eq(userId), eq("the goal"), isNull()))
                .thenReturn(runDto(runId, "COMPLETED", "an answer", List.of(stepDto(UUID.randomUUID()))));

        mockMvc.perform(post("/api/v1/agent/runs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goal\":\"the goal\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(runId.toString()))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.answer").value("an answer"))
                .andExpect(jsonPath("$.data.steps[0].tool").value("searchKnowledge"))
                .andExpect(jsonPath("$.data.steps[0].arguments.query").value("k8s"));

        verify(runs).createRun(userId, "the goal", null);
    }

    @Test
    void maxStepsIsPassedThrough() throws Exception {
        authenticate();
        when(runs.createRun(eq(userId), eq("g"), eq(3)))
                .thenReturn(runDto(UUID.randomUUID(), "COMPLETED", "a", List.of()));

        mockMvc.perform(post("/api/v1/agent/runs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goal\":\"g\",\"maxSteps\":3}"))
                .andExpect(status().isOk());

        verify(runs).createRun(userId, "g", 3);
    }

    @Test
    void missingGoalReturns400() throws Exception {
        authenticate();
        mockMvc.perform(post("/api/v1/agent/runs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        verify(runs, never()).createRun(any(), any(), any());
    }

    // ── read ────────────────────────────────────────────────────────────────────

    @Test
    void getRunReturnsTheRunDtoWithSteps() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        when(runs.getRun(userId, runId))
                .thenReturn(runDto(runId, "COMPLETED", "an answer", List.of(stepDto(UUID.randomUUID()))));

        mockMvc.perform(get("/api/v1/agent/runs/{id}", runId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(runId.toString()))
                .andExpect(jsonPath("$.data.steps[0].status").value("SUCCEEDED"));

        verify(runs).getRun(userId, runId);
    }

    @Test
    void listRunsReturnsAPage() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        when(runs.listRuns(eq(userId), eq(0), eq(5)))
                .thenReturn(new RunPage(List.of(runDto(runId, "COMPLETED", "a", List.of())), 2));

        mockMvc.perform(get("/api/v1/agent/runs").param("page", "0").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items[0].id").value(runId.toString()));

        verify(runs).listRuns(userId, 0, 5);
    }

    // ── confirm / reject ────────────────────────────────────────────────────────

    @Test
    void confirmReturnsTheRunDto() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        UUID stepId = UUID.randomUUID();
        when(runs.confirm(eq(userId), eq(runId), eq(stepId), eq("ok")))
                .thenReturn(runDto(runId, "COMPLETED", "done", List.of(stepDto(stepId))));

        mockMvc.perform(post("/api/v1/agent/runs/{id}/confirm", runId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stepId\":\"" + stepId + "\",\"note\":\"ok\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        verify(runs).confirm(userId, runId, stepId, "ok");
    }

    @Test
    void rejectReturnsTheRunDto() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        when(runs.reject(eq(userId), eq(runId), eq("nope")))
                .thenReturn(runDto(runId, "REJECTED", null, List.of()));

        mockMvc.perform(post("/api/v1/agent/runs/{id}/reject", runId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"nope\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        verify(runs).reject(userId, runId, "nope");
    }

    @Test
    void confirmingARunThatIsNotPausedReturns400() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        when(runs.confirm(any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Run is not awaiting confirmation"));

        mockMvc.perform(post("/api/v1/agent/runs/{id}/confirm", runId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
