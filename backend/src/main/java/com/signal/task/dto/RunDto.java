package com.signal.task.dto;

import com.signal.task.entity.JobRun;

import java.time.Instant;
import java.util.UUID;

/**
 * Wire shape of one job run. Field names are part of the contract the frontend is built
 * against — do not rename them.
 */
public record RunDto(
        UUID id,
        UUID jobId,
        String status,
        int attempt,
        String detail,
        String error,
        Instant startedAt,
        Instant finishedAt,
        Instant createdAt) {

    public static RunDto from(JobRun run) {
        return new RunDto(run.getId(), run.getJobId(), run.getStatus(), run.getAttempt(),
                run.getDetail(), run.getError(), run.getStartedAt(), run.getFinishedAt(),
                run.getCreatedAt());
    }
}
