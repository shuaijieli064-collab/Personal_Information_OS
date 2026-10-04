package com.signal.skill.dto;

import jakarta.validation.constraints.*;

public record SkillRequest(
        @NotBlank @Size(max = 60) String name,
        @Pattern(regexp = "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT", message = "invalid level")
        String level) {}
