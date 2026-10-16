package com.signal.ai.agent;

/** Lifecycle of a single step. Stored as text (see {@code V20__agent_runs.sql}). */
public enum AgentStepStatus {
    /** Planned but not started. */
    PLANNED,
    /** A WRITE / DESTRUCTIVE step waiting for confirmation. */
    PENDING_CONFIRMATION,
    /** Currently executing. */
    RUNNING,
    /** Completed successfully. */
    SUCCEEDED,
    /** Failed after the retry was exhausted; the run continues with the remaining steps. */
    FAILED,
    /** Never executed (e.g. the plan was dropped). */
    SKIPPED,
    /** The user rejected this step. */
    REJECTED
}
