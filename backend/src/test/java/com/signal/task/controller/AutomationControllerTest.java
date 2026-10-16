package com.signal.task.controller;

import com.signal.common.GlobalExceptionHandler;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.task.AutomationService;
import com.signal.task.dto.JobDto;
import com.signal.task.dto.JobsResponse;
import com.signal.task.dto.RunDto;
import com.signal.task.dto.RunPage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Standalone MockMvc (no Spring context, no DB) covering the Phase 8 automation contract:
 * route wiring, principal → userId propagation, upsert / patch passthrough, run + retry,
 * and the 404 for another user's job.
 */
class AutomationControllerTest {

    private final AutomationService service = mock(AutomationService.class);

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new AutomationController(service))
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

    private static JobDto jobDto(UUID id, String type, int interval, boolean enabled) {
        Instant now = Instant.now();
        return new JobDto(id, type, interval, enabled, null, now, 0, now, now);
    }

    private static RunDto runDto(UUID id, UUID jobId, String status) {
        Instant now = Instant.now();
        return new RunDto(id, jobId, status, 1, "detail", null, now, now, now);
    }

    @Test
    void listJobsReturnsTheCallersJobs() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();
        when(service.listJobs(userId))
                .thenReturn(new JobsResponse(List.of(jobDto(jobId, "SOURCE_SYNC", 60, true))));

        mockMvc.perform(get("/api/v1/automation/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobs[0].id").value(jobId.toString()))
                .andExpect(jsonPath("$.data.jobs[0].type").value("SOURCE_SYNC"))
                .andExpect(jsonPath("$.data.jobs[0].intervalMinutes").value(60))
                .andExpect(jsonPath("$.data.jobs[0].enabled").value(true));

        verify(service).listJobs(userId);
    }

    @Test
    void createJobUpsertsAndReturnsTheJob() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();
        when(service.upsertJob(userId, "SOURCE_SYNC", 60, true))
                .thenReturn(jobDto(jobId, "SOURCE_SYNC", 60, true));

        mockMvc.perform(post("/api/v1/automation/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"SOURCE_SYNC\",\"intervalMinutes\":60,\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(jobId.toString()))
                .andExpect(jsonPath("$.data.type").value("SOURCE_SYNC"));

        verify(service).upsertJob(userId, "SOURCE_SYNC", 60, true);
    }

    @Test
    void createJobAllowsOptionalFields() throws Exception {
        authenticate();
        when(service.upsertJob(eq(userId), eq("DAILY_BRIEF"), isNull(), isNull()))
                .thenReturn(jobDto(UUID.randomUUID(), "DAILY_BRIEF", 1440, true));

        mockMvc.perform(post("/api/v1/automation/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"DAILY_BRIEF\"}"))
                .andExpect(status().isOk());

        verify(service).upsertJob(userId, "DAILY_BRIEF", null, null);
    }

    @Test
    void patchJobPassesThePartialUpdateThrough() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();
        when(service.patchJob(userId, jobId, 120, false))
                .thenReturn(jobDto(jobId, "SOURCE_SYNC", 120, false));

        mockMvc.perform(patch("/api/v1/automation/jobs/{id}", jobId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intervalMinutes\":120,\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.intervalMinutes").value(120))
                .andExpect(jsonPath("$.data.enabled").value(false));

        verify(service).patchJob(userId, jobId, 120, false);
    }

    @Test
    void deleteJobReturnsAnEmptyEnvelope() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/automation/jobs/{id}", jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").doesNotExist());

        verify(service).deleteJob(userId, jobId);
    }

    @Test
    void runJobNowReturnsTheRun() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();
        when(service.runJobNow(userId, jobId))
                .thenReturn(runDto(UUID.randomUUID(), jobId, "SUCCEEDED"));

        mockMvc.perform(post("/api/v1/automation/jobs/{id}/run", jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.data.jobId").value(jobId.toString()));

        verify(service).runJobNow(userId, jobId);
    }

    @Test
    void listRunsReturnsAPage() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();
        when(service.listRuns(userId, jobId, 0, 5))
                .thenReturn(new RunPage(List.of(runDto(UUID.randomUUID(), jobId, "FAILED")), 2));

        mockMvc.perform(get("/api/v1/automation/jobs/{id}/runs", jobId)
                        .param("page", "0").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items[0].status").value("FAILED"));

        verify(service).listRuns(userId, jobId, 0, 5);
    }

    @Test
    void retryRunReturnsTheNewRun() throws Exception {
        authenticate();
        UUID runId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();
        when(service.retryRun(userId, runId))
                .thenReturn(runDto(UUID.randomUUID(), jobId, "SUCCEEDED"));

        mockMvc.perform(post("/api/v1/automation/runs/{id}/retry", runId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCEEDED"));

        verify(service).retryRun(userId, runId);
    }

    @Test
    void anotherUsersJobIsNotFound() throws Exception {
        authenticate();
        UUID jobId = UUID.randomUUID();
        when(service.patchJob(any(), any(), any(), any()))
                .thenThrow(new ResourceNotFoundException("Scheduled job not found"));

        mockMvc.perform(patch("/api/v1/automation/jobs/{id}", jobId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }
}
