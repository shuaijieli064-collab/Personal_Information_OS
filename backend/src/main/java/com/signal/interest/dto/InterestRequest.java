package com.signal.interest.dto;

import jakarta.validation.constraints.*;

public record InterestRequest(
        @NotBlank @Size(max = 60) String name,
        @Min(1) @Max(5) Integer weight) {}
