package com.signal.ai.agent.dto;

import java.util.List;
import java.util.Map;

/** Wire shape of one catalogue entry returned by {@code GET /api/v1/agent/tools}. */
public record ToolDto(
        String name,
        String description,
        String permission,
        Map<String, String> parameters,
        List<String> required) {}
