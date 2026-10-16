package com.signal.task;

/**
 * Lifecycle of a single job run. {@code DEAD} is the dead-letter state: the job hit its
 * consecutive-failure cap and was disabled, so it will not run again until a manual
 * retry resets it.
 */
public enum JobStatus {
    RUNNING,
    SUCCEEDED,
    FAILED,
    DEAD
}
