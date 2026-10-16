package com.signal.task;

import com.signal.brief.NotificationService;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.task.entity.JobRun;
import com.signal.task.entity.ScheduledJob;
import com.signal.task.repository.JobRunRepository;
import com.signal.task.repository.ScheduledJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * The automation tick plus the retry / dead-letter policy.
 *
 * <p>Every tick sweeps jobs that are {@code enabled} and due, runs each, and rewrites
 * {@code next_run_at}. The tick is gated on {@code app.automation.enabled} (default
 * {@code true}) so it can be switched off entirely, and it catches <b>everything</b> — a
 * single bad job must never take the sweep down for the rest.
 *
 * <p><b>Retry policy</b> (linear backoff): a failure increments
 * {@code consecutive_failures}, records a {@code FAILED} run and pushes {@code next_run_at}
 * out by {@code retry-backoff-minutes × attempt}. Once {@code consecutive_failures} reaches
 * {@code max-attempts} the run is recorded {@code DEAD}: the job is disabled and a
 * {@code JOB_FAILED} notification is raised. It is not retried forever. A success resets
 * the counter and schedules a full {@code interval_minutes} out.
 */
@Component
public class AutomationScheduler {

    private static final Logger log = LoggerFactory.getLogger(AutomationScheduler.class);

    private final ScheduledJobRepository jobs;
    private final JobRunRepository runs;
    private final JobExecutor executor;
    private final NotificationService notifications;
    private final boolean enabled;
    private final int maxAttempts;
    private final int retryBackoffMinutes;

    public AutomationScheduler(ScheduledJobRepository jobs, JobRunRepository runs,
                               JobExecutor executor, NotificationService notifications,
                               @Value("${app.automation.enabled:true}") boolean enabled,
                               @Value("${app.automation.max-attempts:3}") int maxAttempts,
                               @Value("${app.automation.retry-backoff-minutes:5}") int retryBackoffMinutes) {
        this.jobs = jobs;
        this.runs = runs;
        this.executor = executor;
        this.notifications = notifications;
        this.enabled = enabled;
        this.maxAttempts = maxAttempts;
        this.retryBackoffMinutes = retryBackoffMinutes;
    }

    /** Runs every due job. Never throws — one bad job cannot kill the sweep. */
    @Scheduled(fixedDelayString = "${app.automation.tick-ms:60000}")
    public void tick() {
        if (!enabled) return;
        Instant now = Instant.now();
        for (ScheduledJob job : jobs.findByEnabledTrueAndNextRunAtLessThanEqual(now)) {
            // The query already filters both, but re-checking keeps the policy explicit and
            // makes the sweep safe against a caller that over-returns.
            if (!job.isEnabled()) continue;
            if (job.getNextRunAt() != null && job.getNextRunAt().isAfter(now)) continue;
            try {
                runNow(job);
            } catch (Exception e) {
                // runNow records its own failures; this guard covers the unexpected.
                log.warn("Automation tick entry failed job={} err={}", job.getId(), e.toString());
            }
        }
    }

    /** Runs one job now, records the run, and reschedules or dead-letters it. */
    public JobRun runNow(ScheduledJob job) {
        JobRun run = start(job);
        JobExecutor.JobResult result = executor.execute(job);
        return result.ok() ? succeed(job, run, result.detail()) : fail(job, run, result.error());
    }

    /**
     * The manual escape hatch from the dead-letter queue: re-enables the job, clears its
     * failure count, and runs it again. User-scoped — another user's run → 404.
     */
    public JobRun retryDeadRun(UUID userId, UUID runId) {
        JobRun run = runs.findByIdAndUserId(runId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Job run not found"));
        ScheduledJob job = jobs.findByIdAndUserId(run.getJobId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheduled job not found"));
        job.setEnabled(true);
        job.setConsecutiveFailures(0);
        job.setNextRunAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        jobs.save(job);
        return runNow(job);
    }

    // ── internals ───────────────────────────────────────────────────────────────

    private JobRun start(ScheduledJob job) {
        JobRun run = new JobRun();
        run.setJobId(job.getId());
        run.setUserId(job.getUserId());
        run.setStatus(JobStatus.RUNNING.name());
        run.setAttempt(job.getConsecutiveFailures() + 1);
        run.setStartedAt(Instant.now());
        return runs.save(run);
    }

    private JobRun succeed(ScheduledJob job, JobRun run, String detail) {
        Instant now = Instant.now();
        job.setConsecutiveFailures(0);
        job.setLastRunAt(now);
        job.setNextRunAt(now.plus(Duration.ofMinutes(Math.max(1, job.getIntervalMinutes()))));
        job.setUpdatedAt(now);
        jobs.save(job);

        run.setStatus(JobStatus.SUCCEEDED.name());
        run.setDetail(detail);
        run.setFinishedAt(now);
        return runs.save(run);
    }

    private JobRun fail(ScheduledJob job, JobRun run, String error) {
        Instant now = Instant.now();
        int failures = job.getConsecutiveFailures() + 1;
        job.setConsecutiveFailures(failures);
        job.setLastRunAt(now);
        job.setUpdatedAt(now);

        boolean dead = failures >= maxAttempts;
        if (dead) {
            job.setEnabled(false);
            job.setNextRunAt(now); // disabled, so the value is inert — but the column is NOT NULL
        } else {
            long backoff = (long) Math.max(1, retryBackoffMinutes) * failures;
            job.setNextRunAt(now.plus(Duration.ofMinutes(backoff)));
        }
        jobs.save(job);

        run.setStatus(dead ? JobStatus.DEAD.name() : JobStatus.FAILED.name());
        run.setError(error);
        run.setFinishedAt(now);
        run = runs.save(run);

        if (dead) {
            try {
                notifications.notifyJobFailed(job.getUserId(), job.getType(), error);
            } catch (Exception e) {
                // A failed notification must not undo the dead-lettering.
                log.warn("Could not raise JOB_FAILED notification job={} err={}", job.getId(), e.toString());
            }
        }
        return run;
    }
}
