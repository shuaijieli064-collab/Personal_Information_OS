package com.signal.task;

import com.signal.task.entity.ScheduledJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Dispatches a job to its worker and reports the outcome as data, not as an exception.
 *
 * <p>The dispatch is an explicit {@code switch} over {@link JobType} — deliberately not
 * reflection — so adding a job type is a compile error until it is wired, and the whole
 * table is visible in one place.
 *
 * <p>A misconfigured job (no type, an unknown type) or a worker that throws yields a
 * {@link JobResult} carrying the error; the scheduler then records it as a failed run.
 * Nothing escapes to the tick, so one bad job can never take the sweep down.
 */
@Component
public class JobExecutor {

    private static final Logger log = LoggerFactory.getLogger(JobExecutor.class);

    private final SourceSyncJob sourceSync;
    private final DailyBriefJob dailyBrief;
    private final FeedbackLoopJob feedbackLoop;

    public JobExecutor(SourceSyncJob sourceSync, DailyBriefJob dailyBrief, FeedbackLoopJob feedbackLoop) {
        this.sourceSync = sourceSync;
        this.dailyBrief = dailyBrief;
        this.feedbackLoop = feedbackLoop;
    }

    /** Outcome of one dispatch. {@code error == null} means success. */
    public record JobResult(String detail, String error) {
        public boolean ok() { return error == null; }
    }

    /** Runs the job's type against the user; never throws. */
    public JobResult execute(ScheduledJob job) {
        try {
            JobType type = parseType(job.getType());
            String detail = switch (type) {
                case SOURCE_SYNC -> sourceSync.run(job.getUserId());
                case DAILY_BRIEF -> dailyBrief.run(job.getUserId());
                case FEEDBACK_LOOP -> feedbackLoop.run(job.getUserId());
            };
            return new JobResult(detail, null);
        } catch (Exception e) {
            log.warn("Job execution failed type={} user={} err={}",
                    job.getType(), job.getUserId(), e.toString());
            return new JobResult(null, errorMessage(e));
        }
    }

    private static JobType parseType(String type) {
        if (type == null || type.isBlank()) {
            throw new IllegalStateException("Job has no type");
        }
        try {
            return JobType.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Unknown job type: " + type);
        }
    }

    private static String errorMessage(Exception e) {
        String message = e.getMessage();
        return (message == null || message.isBlank()) ? e.toString() : message;
    }
}
