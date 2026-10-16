package com.signal.task;

import com.signal.brief.NotificationService;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.task.entity.JobRun;
import com.signal.task.entity.ScheduledJob;
import com.signal.task.repository.JobRunRepository;
import com.signal.task.repository.ScheduledJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The tick and the retry / dead-letter policy, driven entirely through mocks — no DB, no
 * clock, no scheduler firing. {@code enabled = true}, {@code max-attempts = 3},
 * {@code retry-backoff-minutes = 5}.
 */
class AutomationSchedulerTest {

    private final ScheduledJobRepository jobs = mock(ScheduledJobRepository.class);
    private final JobRunRepository runs = mock(JobRunRepository.class);
    private final JobExecutor executor = mock(JobExecutor.class);
    private final NotificationService notifications = mock(NotificationService.class);

    private final AutomationScheduler scheduler =
            new AutomationScheduler(jobs, runs, executor, notifications, true, 3, 5);

    private final UUID user = UUID.randomUUID();
    private final List<JobRun> savedRuns = new ArrayList<>();

    @BeforeEach
    void wireRepositories() {
        when(runs.save(any(JobRun.class))).thenAnswer(inv -> {
            JobRun run = inv.getArgument(0);
            savedRuns.add(run);
            return run;
        });
        when(jobs.save(any(ScheduledJob.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private ScheduledJob job(int failures) {
        ScheduledJob job = new ScheduledJob();
        job.setId(UUID.randomUUID());
        job.setUserId(user);
        job.setType("SOURCE_SYNC");
        job.setIntervalMinutes(60);
        job.setEnabled(true);
        job.setNextRunAt(Instant.now().minusSeconds(60));
        job.setConsecutiveFailures(failures);
        return job;
    }

    private JobRun lastRun() {
        return savedRuns.get(savedRuns.size() - 1);
    }

    private void dueJob(ScheduledJob job) {
        when(jobs.findByEnabledTrueAndNextRunAtLessThanEqual(any())).thenReturn(List.of(job));
    }

    // ── tick: due / disabled / not-yet-due ──────────────────────────────────────

    @Test
    void dueJobRunsAndIsRescheduledByItsInterval() {
        ScheduledJob job = job(0);
        dueJob(job);
        when(executor.execute(job)).thenReturn(new JobExecutor.JobResult("1 of 1 sources synced", null));

        Instant before = Instant.now();
        scheduler.tick();

        assertEquals(0, job.getConsecutiveFailures());
        assertNotNull(job.getLastRunAt());
        assertTrue(job.getNextRunAt().isAfter(before.plus(Duration.ofMinutes(59))),
                "next run is a full interval out");
        assertTrue(job.getNextRunAt().isBefore(before.plus(Duration.ofMinutes(61))));
        assertEquals("SUCCEEDED", lastRun().getStatus());
        assertEquals("1 of 1 sources synced", lastRun().getDetail());
    }

    @Test
    void disabledJobIsSkipped() {
        ScheduledJob job = job(0);
        job.setEnabled(false);
        dueJob(job);

        scheduler.tick();

        verifyNoInteractions(executor);
        assertTrue(savedRuns.isEmpty(), "a disabled job produces no run");
    }

    @Test
    void notYetDueJobIsSkipped() {
        ScheduledJob job = job(0);
        job.setNextRunAt(Instant.now().plus(Duration.ofMinutes(30)));
        dueJob(job);

        scheduler.tick();

        verifyNoInteractions(executor);
        assertTrue(savedRuns.isEmpty());
    }

    @Test
    void aThrowingJobDoesNotStopTheOtherJobsInTheSameTick() {
        ScheduledJob bad = job(0);
        ScheduledJob good = job(0);
        when(jobs.findByEnabledTrueAndNextRunAtLessThanEqual(any())).thenReturn(List.of(bad, good));
        when(executor.execute(bad)).thenThrow(new RuntimeException("executor blew up"));
        when(executor.execute(good)).thenReturn(new JobExecutor.JobResult("ok", null));

        assertDoesNotThrow(() -> scheduler.tick());

        verify(executor).execute(good);
        assertTrue(savedRuns.stream().anyMatch(r -> "SUCCEEDED".equals(r.getStatus())
                && r.getJobId().equals(good.getId())), "the good job still completed");
    }

    @Test
    void aFailingJobDoesNotStopTheOtherJobsInTheSameTick() {
        ScheduledJob bad = job(0);
        ScheduledJob good = job(0);
        when(jobs.findByEnabledTrueAndNextRunAtLessThanEqual(any())).thenReturn(List.of(bad, good));
        when(executor.execute(bad)).thenReturn(new JobExecutor.JobResult(null, "boom"));
        when(executor.execute(good)).thenReturn(new JobExecutor.JobResult("ok", null));

        scheduler.tick();

        assertTrue(savedRuns.stream().anyMatch(r -> "FAILED".equals(r.getStatus())));
        assertTrue(savedRuns.stream().anyMatch(r -> "SUCCEEDED".equals(r.getStatus())));
    }

    @Test
    void whenDisabledTheTickDoesNothing() {
        AutomationScheduler off =
                new AutomationScheduler(jobs, runs, executor, notifications, false, 3, 5);

        off.tick();

        verifyNoInteractions(jobs, executor);
    }

    // ── retry / backoff / dead letter ───────────────────────────────────────────

    @Test
    void aFailureSchedulesALinearBackoffRetry() {
        ScheduledJob job = job(0);
        when(executor.execute(job)).thenReturn(new JobExecutor.JobResult(null, "boom"));

        Instant before = Instant.now();
        scheduler.runNow(job);

        assertEquals(1, job.getConsecutiveFailures());
        assertTrue(job.isEnabled(), "below the cap the job keeps retrying");
        assertEquals("FAILED", lastRun().getStatus());
        assertEquals("boom", lastRun().getError());
        assertEquals(1, lastRun().getAttempt());
        // backoff = retry-backoff-minutes × attempt = 5 × 1
        assertTrue(job.getNextRunAt().isAfter(before.plus(Duration.ofMinutes(4))));
        assertTrue(job.getNextRunAt().isBefore(before.plus(Duration.ofMinutes(6))));
    }

    @Test
    void theSecondFailureBacksOffFurther() {
        ScheduledJob job = job(1);
        when(executor.execute(job)).thenReturn(new JobExecutor.JobResult(null, "boom"));

        Instant before = Instant.now();
        scheduler.runNow(job);

        assertEquals(2, job.getConsecutiveFailures());
        assertEquals(2, lastRun().getAttempt());
        // backoff = 5 × 2 = 10 minutes
        assertTrue(job.getNextRunAt().isAfter(before.plus(Duration.ofMinutes(9))));
        assertTrue(job.getNextRunAt().isBefore(before.plus(Duration.ofMinutes(11))));
    }

    @Test
    void reachingMaxAttemptsDeadLettersTheJobAndNotifies() {
        ScheduledJob job = job(2); // one failure away from the cap of 3
        when(executor.execute(job)).thenReturn(new JobExecutor.JobResult(null, "boom"));

        scheduler.runNow(job);

        assertEquals(3, job.getConsecutiveFailures());
        assertFalse(job.isEnabled(), "a dead-lettered job is disabled");
        assertEquals("DEAD", lastRun().getStatus());
        verify(notifications).notifyJobFailed(user, "SOURCE_SYNC", "boom");
    }

    @Test
    void aSuccessResetsTheFailureCounterAndReschedulesAFullInterval() {
        ScheduledJob job = job(2);
        when(executor.execute(job)).thenReturn(new JobExecutor.JobResult("ok", null));

        Instant before = Instant.now();
        scheduler.runNow(job);

        assertEquals(0, job.getConsecutiveFailures());
        assertTrue(job.isEnabled());
        assertEquals("SUCCEEDED", lastRun().getStatus());
        assertTrue(job.getNextRunAt().isAfter(before.plus(Duration.ofMinutes(59))));
        verify(notifications, never()).notifyJobFailed(any(), any(), any());
    }

    // ── manual retry ────────────────────────────────────────────────────────────

    @Test
    void retryDeadRunReEnablesResetsAndRunsTheJob() {
        ScheduledJob job = job(3);
        job.setEnabled(false);
        JobRun dead = new JobRun();
        dead.setId(UUID.randomUUID());
        dead.setJobId(job.getId());
        dead.setUserId(user);
        dead.setStatus("DEAD");
        when(runs.findByIdAndUserId(dead.getId(), user)).thenReturn(Optional.of(dead));
        when(jobs.findByIdAndUserId(job.getId(), user)).thenReturn(Optional.of(job));
        when(executor.execute(job)).thenReturn(new JobExecutor.JobResult("ok", null));

        JobRun fresh = scheduler.retryDeadRun(user, dead.getId());

        assertTrue(job.isEnabled());
        assertEquals(0, job.getConsecutiveFailures());
        assertEquals("SUCCEEDED", fresh.getStatus());
        assertEquals(1, fresh.getAttempt());
        verify(executor).execute(job);
    }

    @Test
    void retryingAnotherUsersRunIsNotFound() {
        when(runs.findByIdAndUserId(any(), eq(user))).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> scheduler.retryDeadRun(user, UUID.randomUUID()));
    }
}
