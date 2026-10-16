package com.signal.task;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.task.dto.JobDto;
import com.signal.task.dto.JobsResponse;
import com.signal.task.dto.RunDto;
import com.signal.task.dto.RunPage;
import com.signal.task.entity.JobRun;
import com.signal.task.entity.ScheduledJob;
import com.signal.task.repository.JobRunRepository;
import com.signal.task.repository.ScheduledJobRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * User-scoped CRUD over scheduled jobs plus the two run actions (run now, retry). The
 * actual execution and the retry / dead-letter policy live in {@link AutomationScheduler};
 * this service owns ownership checks and the request-shaping (defaults, clamping).
 *
 * <p>Every lookup is by {@code (id, userId)}, so another user's job or run is a 404 —
 * never a leak.
 */
@Service
public class AutomationService {

    private final ScheduledJobRepository jobs;
    private final JobRunRepository runs;
    private final AutomationScheduler scheduler;

    public AutomationService(ScheduledJobRepository jobs, JobRunRepository runs,
                             AutomationScheduler scheduler) {
        this.jobs = jobs;
        this.runs = runs;
        this.scheduler = scheduler;
    }

    @Transactional(readOnly = true)
    public JobsResponse listJobs(UUID userId) {
        return new JobsResponse(jobs.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(JobDto::from)
                .toList());
    }

    /**
     * Upsert on {@code (user, type)}. A new job is scheduled one interval out; an existing
     * one has its interval / enabled flag rewritten. {@code intervalMinutes} falls back to
     * the type's default and is clamped to ≥ 1; {@code enabled} defaults to true.
     */
    @Transactional
    public JobDto upsertJob(UUID userId, String type, Integer intervalMinutes, Boolean enabled) {
        JobType jobType = parseType(type);
        int interval = clampInterval(intervalMinutes, jobType);

        ScheduledJob job = jobs.findByUserIdAndType(userId, jobType.name())
                .orElseGet(ScheduledJob::new);
        if (job.getId() == null) {
            job.setUserId(userId);
            job.setType(jobType.name());
            job.setNextRunAt(Instant.now().plus(Duration.ofMinutes(interval)));
        }
        job.setIntervalMinutes(interval);
        job.setEnabled(enabled == null || enabled);
        job.setUpdatedAt(Instant.now());
        return JobDto.from(jobs.save(job));
    }

    @Transactional
    public JobDto patchJob(UUID userId, UUID id, Integer intervalMinutes, Boolean enabled) {
        ScheduledJob job = load(userId, id);
        if (intervalMinutes != null) job.setIntervalMinutes(Math.max(1, intervalMinutes));
        if (enabled != null) job.setEnabled(enabled);
        job.setUpdatedAt(Instant.now());
        return JobDto.from(jobs.save(job));
    }

    @Transactional
    public void deleteJob(UUID userId, UUID id) {
        jobs.delete(load(userId, id)); // IDOR guard: not owned → 404
    }

    /** Runs the job immediately, ignoring {@code next_run_at}, and returns the run. */
    @Transactional
    public RunDto runJobNow(UUID userId, UUID id) {
        return RunDto.from(scheduler.runNow(load(userId, id)));
    }

    @Transactional(readOnly = true)
    public RunPage listRuns(UUID userId, UUID jobId, int page, int size) {
        load(userId, jobId); // ownership check before exposing any run
        int p = Math.max(0, page);
        int s = Math.min(Math.max(size, 1), 100);
        Page<JobRun> result = runs.findByJobIdOrderByCreatedAtDesc(jobId, PageRequest.of(p, s));
        return new RunPage(result.getContent().stream().map(RunDto::from).toList(), result.getTotalElements());
    }

    /** Retries a dead (or failed) run's job; returns the fresh run. */
    @Transactional
    public RunDto retryRun(UUID userId, UUID runId) {
        return RunDto.from(scheduler.retryDeadRun(userId, runId));
    }

    // ── internals ───────────────────────────────────────────────────────────────

    private ScheduledJob load(UUID userId, UUID id) {
        return jobs.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheduled job not found"));
    }

    /** IllegalArgumentException (→ 400) rather than a 500 for an unknown / missing type. */
    private static JobType parseType(String type) {
        if (type == null || type.isBlank()) throw new IllegalArgumentException("type is required");
        try {
            return JobType.valueOf(type.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown job type: " + type);
        }
    }

    private static int clampInterval(Integer requested, JobType type) {
        int value = requested == null ? type.defaultIntervalMinutes() : requested;
        return Math.max(1, value);
    }
}
