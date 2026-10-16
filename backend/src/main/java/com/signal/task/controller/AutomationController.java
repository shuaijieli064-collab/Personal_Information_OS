package com.signal.task.controller;

import com.signal.common.ApiResponse;
import com.signal.task.AutomationService;
import com.signal.task.dto.JobDto;
import com.signal.task.dto.JobsResponse;
import com.signal.task.dto.RunDto;
import com.signal.task.dto.RunPage;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Phase 8 automation API. All routes inherit {@code SecurityConfig}: authenticated, and
 * user-scoped inside the service (another user's job / run id → 404, never a leak).
 */
@RestController
@RequestMapping("/api/v1/automation")
public class AutomationController {

    private final AutomationService service;

    public AutomationController(AutomationService service) {
        this.service = service;
    }

    public record CreateJobRequest(String type, Integer intervalMinutes, Boolean enabled) {}

    public record PatchJobRequest(Integer intervalMinutes, Boolean enabled) {}

    @GetMapping("/jobs")
    public ApiResponse<JobsResponse> list() {
        return ApiResponse.ok(service.listJobs(userId()));
    }

    @PostMapping("/jobs")
    public ApiResponse<JobDto> upsert(@RequestBody CreateJobRequest req) {
        return ApiResponse.ok(service.upsertJob(userId(), req.type(), req.intervalMinutes(), req.enabled()));
    }

    @PatchMapping("/jobs/{id}")
    public ApiResponse<JobDto> patch(@PathVariable UUID id, @RequestBody PatchJobRequest req) {
        return ApiResponse.ok(service.patchJob(userId(), id, req.intervalMinutes(), req.enabled()));
    }

    @DeleteMapping("/jobs/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.deleteJob(userId(), id);
        return ApiResponse.ok(null);
    }

    /** Runs the job now, ignoring {@code next_run_at}. */
    @PostMapping("/jobs/{id}/run")
    public ApiResponse<RunDto> run(@PathVariable UUID id) {
        return ApiResponse.ok(service.runJobNow(userId(), id));
    }

    /** Newest-first run history for one job. */
    @GetMapping("/jobs/{id}/runs")
    public ApiResponse<RunPage> runs(@PathVariable UUID id,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(service.listRuns(userId(), id, page, size));
    }

    /** Retries a dead (or failed) run's job. */
    @PostMapping("/runs/{id}/retry")
    public ApiResponse<RunDto> retry(@PathVariable UUID id) {
        return ApiResponse.ok(service.retryRun(userId(), id));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
