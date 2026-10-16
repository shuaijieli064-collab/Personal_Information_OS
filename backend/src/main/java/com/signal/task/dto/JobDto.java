package com.signal.task.dto;

import com.signal.task.entity.ScheduledJob;

import java.time.Instant;
import java.util.UUID;

/**
 * Wire shape of a scheduled job. Field names are part of the contract the frontend is
 * built against — do not rename them.
 */
public record JobDto(
        UUID id,
        String type,
        int intervalMinutes,
        boolean enabled,
        Instant lastRunAt,
        Instant nextRunAt,
        int consecutiveFailures,
        Instant createdAt,
        Instant updatedAt) {

    public static JobDto from(ScheduledJob job) {
        return new JobDto(job.getId(), job.getType(), job.getIntervalMinutes(), job.isEnabled(),
                job.getLastRunAt(), job.getNextRunAt(), job.getConsecutiveFailures(),
                job.getCreatedAt(), job.getUpdatedAt());
    }
}
