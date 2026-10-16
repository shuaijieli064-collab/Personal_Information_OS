package com.signal.ai.agent;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JSON helpers for the agent layer.
 *
 * <p>Tool arguments / results are persisted as plain {@code text} (there is no jsonb
 * mapping in this codebase — see {@code V20__agent_runs.sql}). This class is the single
 * place that converts between stored text and the plain Java structures the tools and the
 * HTTP DTOs speak, so a malformed value never escapes as a raw {@link JsonNode}.
 */
final class AgentJson {

    static final ObjectMapper JSON = new ObjectMapper();

    private AgentJson() {}

    /** Serialises a value to JSON text; {@code null} stays {@code null}. */
    static String toText(Object value) {
        if (value == null) return null;
        return JSON.writeValueAsString(value);
    }

    /** Parses stored JSON text into a plain structure ({@code Map} / {@code List} / scalar). */
    static Object parse(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            return toJava(JSON.readTree(text));
        } catch (Exception e) {
            return null;
        }
    }

    /** Parses stored JSON text into a parameter map; anything else becomes an empty map. */
    static Map<String, Object> parseObject(String text) {
        Object parsed = parse(text);
        if (parsed instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                out.put(String.valueOf(e.getKey()), e.getValue());
            }
            return out;
        }
        return new LinkedHashMap<>();
    }

    /** Recursively converts a {@link JsonNode} to plain Java values. */
    static Object toJava(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isObject()) {
            Map<String, Object> map = new LinkedHashMap<>();
            for (Map.Entry<String, JsonNode> e : node.properties()) {
                map.put(e.getKey(), toJava(e.getValue()));
            }
            return map;
        }
        if (node.isArray()) {
            List<Object> list = new ArrayList<>();
            for (JsonNode item : node) list.add(toJava(item));
            return list;
        }
        if (node.isBoolean()) return node.booleanValue();
        if (node.isNumber()) return node.numberValue();
        return node.asText();
    }
}
