package com.signal.understanding.dto;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.signal.understanding.entity.InformationUnderstanding;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Wire shape for an understanding row.
 *
 * <p>The table keeps topics/entities/keyPoints as JSON text columns. Handing that string
 * straight to the client makes every consumer parse it themselves — and one that forgets
 * gets a string where it expected an array. This DTO returns real arrays instead.
 */
public record UnderstandingResponse(
        UUID id,
        UUID informationId,
        String language,
        String contentType,
        String classification,
        Double confidence,
        Double relevanceScore,
        String whyRelevant,
        Double signalScore,
        String scoreFactors,
        List<String> topics,
        List<String> entities,
        String summary,
        List<String> keyPoints,
        String status,
        String model,
        String modelVersion,
        Instant processedAt,
        Instant createdAt,
        Instant updatedAt) {

    private static final ObjectMapper JSON = new ObjectMapper();

    public static UnderstandingResponse from(InformationUnderstanding e) {
        if (e == null) return null;
        return new UnderstandingResponse(
                e.getId(),
                e.getInformationId(),
                e.getLanguage(),
                e.getContentType(),
                e.getClassification(),
                e.getConfidence(),
                e.getRelevanceScore(),
                e.getWhyRelevant(),
                e.getSignalScore(),
                e.getScoreFactors(),
                readList(e.getTopics()),
                readList(e.getEntities()),
                e.getSummary(),
                readList(e.getKeyPoints()),
                e.getStatus(),
                e.getModel(),
                e.getModelVersion(),
                e.getProcessedAt(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }

    /** Null/blank/malformed input all collapse to an empty list — never throws at the edge. */
    private static List<String> readList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode node = JSON.readTree(json);
            if (node == null || !node.isArray()) return List.of();
            List<String> out = new ArrayList<>();
            for (JsonNode item : node) {
                if (item != null && !item.isNull()) out.add(item.asText());
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }
}
