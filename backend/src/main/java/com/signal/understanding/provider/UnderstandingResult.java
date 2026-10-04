package com.signal.understanding.provider;

/** Model-agnostic understanding output. External content is UNTRUSTED_CONTENT — never executed. */
public record UnderstandingResult(
        String language,
        String contentType,
        String classification,
        String topicsJson,
        String entitiesJson,
        String summary,
        String model,
        String modelVersion) {
}
