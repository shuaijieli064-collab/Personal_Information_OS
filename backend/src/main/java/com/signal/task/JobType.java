package com.signal.task;

/**
 * The kinds of recurring work the automation layer can schedule. Each carries its own
 * default cadence so a job created without an explicit interval still runs sensibly:
 * sources change often, a brief is daily, and the feedback loop is a periodic tidy-up.
 */
public enum JobType {

    /** Pull new items from every enabled source. */
    SOURCE_SYNC(60),

    /** Build and persist the daily brief. */
    DAILY_BRIEF(1440),

    /** Re-apply user feedback to signal scores. */
    FEEDBACK_LOOP(360);

    private final int defaultIntervalMinutes;

    JobType(int defaultIntervalMinutes) {
        this.defaultIntervalMinutes = defaultIntervalMinutes;
    }

    /** The interval used when the caller does not supply one. */
    public int defaultIntervalMinutes() {
        return defaultIntervalMinutes;
    }
}
