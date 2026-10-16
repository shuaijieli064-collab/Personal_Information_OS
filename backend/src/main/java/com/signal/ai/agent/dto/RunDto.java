package com.signal.ai.agent.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Wire shape of an agent run. Field names are part of the contract the frontend is built
 * against — do not rename them.
 *
 * <p>{@code arguments} / {@code result} are parsed back from the stored text into JSON
 * objects (or {@code null}). The list endpoint returns runs with an empty {@code steps}
 * list; the detail endpoint returns the full steps.
 */
public record RunDto(
        UUID id,
        String goal,
        String status,
        String answer,
        String model,
        String error,
        Instant createdAt,
        Instant updatedAt,
        List<StepDto> steps) {}
