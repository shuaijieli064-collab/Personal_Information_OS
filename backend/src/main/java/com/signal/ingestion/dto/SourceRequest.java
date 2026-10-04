package com.signal.ingestion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record SourceRequest(
        @NotBlank String name,
        @NotBlank @Pattern(regexp = "RSS|GITHUB|URL|FILE", message = "must be RSS/GITHUB/URL/FILE") String type,
        String url) {
}
