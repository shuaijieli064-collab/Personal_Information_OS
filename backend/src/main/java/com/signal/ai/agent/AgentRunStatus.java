package com.signal.ai.agent;

/** Lifecycle of one agent run. Stored as text (see {@code V20__agent_runs.sql}). */
public enum AgentRunStatus {
    /** A plan is being produced. */
    PLANNING,
    /** Steps are executing. */
    RUNNING,
    /** A WRITE / DESTRUCTIVE step is waiting for the user's confirmation. */
    AWAITING_CONFIRMATION,
    /** Every step finished (or was skipped) and an answer was produced. */
    COMPLETED,
    /** The run could not be carried out. */
    FAILED,
    /** The user rejected the pending step. */
    REJECTED
}
