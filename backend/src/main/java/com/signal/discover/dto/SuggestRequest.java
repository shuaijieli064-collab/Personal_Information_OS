package com.signal.discover.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** "Tell me what you want to follow" — a free-text information need, not a source URL. */
public record SuggestRequest(
        @NotBlank @Size(min = 2, max = 200) String query,
        @Min(1) @Max(5) Integer limit) {}
