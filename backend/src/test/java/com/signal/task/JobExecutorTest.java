package com.signal.task;

import com.signal.task.entity.ScheduledJob;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * The dispatch table and its error contract: each {@link JobType} reaches exactly one
 * worker, and a misconfigured job (or a worker that throws) comes back as a
 * {@link JobExecutor.JobResult} carrying the error — never as an exception escaping to
 * the tick.
 */
class JobExecutorTest {

    private final SourceSyncJob sourceSync = mock(SourceSyncJob.class);
    private final DailyBriefJob dailyBrief = mock(DailyBriefJob.class);
    private final FeedbackLoopJob feedbackLoop = mock(FeedbackLoopJob.class);
    private final JobExecutor executor = new JobExecutor(sourceSync, dailyBrief, feedbackLoop);

    private final UUID user = UUID.randomUUID();

    private ScheduledJob job(String type) {
        ScheduledJob job = new ScheduledJob();
        job.setId(UUID.randomUUID());
        job.setUserId(user);
        job.setType(type);
        return job;
    }

    @Test
    void sourceSyncDispatchesToSourceSyncJob() {
        when(sourceSync.run(user)).thenReturn("3 of 4 sources synced");

        JobExecutor.JobResult result = executor.execute(job("SOURCE_SYNC"));

        assertTrue(result.ok());
        assertEquals("3 of 4 sources synced", result.detail());
        verify(sourceSync).run(user);
        verifyNoInteractions(dailyBrief, feedbackLoop);
    }

    @Test
    void dailyBriefDispatchesToDailyBriefJob() {
        when(dailyBrief.run(user)).thenReturn("Daily brief generated");

        JobExecutor.JobResult result = executor.execute(job("DAILY_BRIEF"));

        assertTrue(result.ok());
        assertEquals("Daily brief generated", result.detail());
        verify(dailyBrief).run(user);
        verifyNoInteractions(sourceSync, feedbackLoop);
    }

    @Test
    void feedbackLoopDispatchesToFeedbackLoopJob() {
        when(feedbackLoop.run(user)).thenReturn("2 signals adjusted from feedback");

        JobExecutor.JobResult result = executor.execute(job("FEEDBACK_LOOP"));

        assertTrue(result.ok());
        assertEquals("2 signals adjusted from feedback", result.detail());
        verify(feedbackLoop).run(user);
        verifyNoInteractions(sourceSync, dailyBrief);
    }

    // ── misconfigured / failing jobs ────────────────────────────────────────────

    @Test
    void unknownTypeIsRecordedAsAnErrorNotThrown() {
        JobExecutor.JobResult result = executor.execute(job("NOT_A_JOB"));

        assertFalse(result.ok());
        assertNull(result.detail());
        assertTrue(result.error().contains("NOT_A_JOB"), result.error());
        verifyNoInteractions(sourceSync, dailyBrief, feedbackLoop);
    }

    @Test
    void missingTypeIsRecordedAsAnErrorNotThrown() {
        JobExecutor.JobResult result = executor.execute(job(null));

        assertFalse(result.ok());
        assertNotNull(result.error());
        verifyNoInteractions(sourceSync, dailyBrief, feedbackLoop);
    }

    @Test
    void aThrowingWorkerIsRecordedAsAnErrorNotThrown() {
        when(feedbackLoop.run(user)).thenThrow(new RuntimeException("boom"));

        JobExecutor.JobResult result = assertDoesNotThrow(() -> executor.execute(job("FEEDBACK_LOOP")));

        assertFalse(result.ok());
        assertEquals("boom", result.error());
    }
}
