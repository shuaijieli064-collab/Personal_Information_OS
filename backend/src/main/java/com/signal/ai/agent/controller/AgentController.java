package com.signal.ai.agent.controller;

import com.signal.ai.agent.AgentRunService;
import com.signal.ai.agent.dto.RunDto;
import com.signal.ai.agent.dto.RunPage;
import com.signal.ai.agent.dto.ToolDto;
import com.signal.ai.tools.AgentTool;
import com.signal.ai.tools.ToolRegistry;
import com.signal.common.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Phase 7 Agent API. All routes inherit {@code SecurityConfig}: authenticated, and
 * user-scoped inside the service (the caller's principal drives every query).
 *
 * <p>Confirming or rejecting a run that is not {@code AWAITING_CONFIRMATION} raises
 * {@link IllegalArgumentException} inside the executor, which {@code GlobalExceptionHandler}
 * maps to a 400 — never a 500.
 */
@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {

    private final ToolRegistry registry;
    private final AgentRunService runs;

    public AgentController(ToolRegistry registry, AgentRunService runs) {
        this.registry = registry;
        this.runs = runs;
    }

    public record CreateRunRequest(
            @NotBlank @Size(max = 1000, message = "must be at most 1000 chars") String goal,
            Integer maxSteps) {}

    public record ConfirmRequest(UUID stepId, String note) {}

    public record RejectRequest(String reason) {}

    public record ToolsResponse(List<ToolDto> tools) {}

    /** The tool catalogue the planner and the UI both work from. */
    @GetMapping("/tools")
    public ApiResponse<ToolsResponse> tools() {
        List<ToolDto> tools = registry.all().stream()
                .map(AgentController::toToolDto)
                .toList();
        return ApiResponse.ok(new ToolsResponse(tools));
    }

    /** Plans and runs a goal; may pause at the first WRITE step. */
    @PostMapping("/runs")
    public ApiResponse<RunDto> create(@Valid @RequestBody CreateRunRequest req) {
        return ApiResponse.ok(runs.createRun(userId(), req.goal(), req.maxSteps()));
    }

    /** The caller's runs, newest first. */
    @GetMapping("/runs")
    public ApiResponse<RunPage> list(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(runs.listRuns(userId(), page, size));
    }

    @GetMapping("/runs/{id}")
    public ApiResponse<RunDto> get(@PathVariable UUID id) {
        return ApiResponse.ok(runs.getRun(userId(), id));
    }

    /** Confirms the pending step and continues the run. */
    @PostMapping("/runs/{id}/confirm")
    public ApiResponse<RunDto> confirm(@PathVariable UUID id,
                                       @RequestBody(required = false) ConfirmRequest req) {
        UUID stepId = req == null ? null : req.stepId();
        String note = req == null ? null : req.note();
        return ApiResponse.ok(runs.confirm(userId(), id, stepId, note));
    }

    /** Rejects the pending step and the run. */
    @PostMapping("/runs/{id}/reject")
    public ApiResponse<RunDto> reject(@PathVariable UUID id,
                                      @RequestBody(required = false) RejectRequest req) {
        return ApiResponse.ok(runs.reject(userId(), id, req == null ? null : req.reason()));
    }

    private static ToolDto toToolDto(AgentTool tool) {
        return new ToolDto(tool.name(), tool.description(), tool.permission().name(),
                tool.parameters(), tool.requiredParameters());
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
