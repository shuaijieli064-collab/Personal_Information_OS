package com.signal.ai.agent.dto;

import java.time.Instant;
import java.util.UUID;

/** Wire shape of one agent step. {@code tool} is the field name the frontend expects. */
public record StepDto(
        UUID id,
        int seq,
        String tool,
        String permission,
        String status,
        Object arguments,
        Object result,
        String rationale,
        String error,
        Instant startedAt,
        Instant finishedAt) {}
