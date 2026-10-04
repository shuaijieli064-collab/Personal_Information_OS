package com.signal.goal.dto;

import jakarta.validation.constraints.*;

public record GoalRequest(
        @NotBlank @Size(max = 120) String title,
        @Size(max = 500) String description,
        @Min(1) @Max(5) Integer priority) {}
