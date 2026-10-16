package com.signal.ai.tools;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.StringJoiner;

/**
 * The catalogue of every {@link AgentTool} in the context. Built from the injected bean
 * list, so adding a tool is a matter of declaring one more {@code @Component}.
 *
 * <p>A duplicate name is a programming error, not a runtime condition: it would make
 * tool selection ambiguous, so the registry refuses to start.
 */
@Component
public class ToolRegistry {

    private final Map<String, AgentTool> tools;

    public ToolRegistry(List<AgentTool> tools) {
        Map<String, AgentTool> byName = new LinkedHashMap<>();
        for (AgentTool tool : tools) {
            if (byName.putIfAbsent(tool.name(), tool) != null) {
                throw new IllegalStateException("Duplicate agent tool name: " + tool.name());
            }
        }
        this.tools = Collections.unmodifiableMap(byName);
    }

    public Optional<AgentTool> find(String name) {
        return name == null ? Optional.empty() : Optional.ofNullable(tools.get(name));
    }

    public List<AgentTool> all() {
        return List.copyOf(tools.values());
    }

    /**
     * Compact, one-line-per-tool catalogue for the planner prompt: name, permission,
     * description and parameters (required ones starred).
     */
    public String describe() {
        StringJoiner lines = new StringJoiner("\n");
        for (AgentTool tool : tools.values()) {
            StringBuilder line = new StringBuilder()
                    .append("- ").append(tool.name())
                    .append(" [").append(tool.permission()).append("] — ")
                    .append(tool.description());
            if (!tool.parameters().isEmpty()) {
                StringJoiner params = new StringJoiner(", ");
                for (Map.Entry<String, String> p : tool.parameters().entrySet()) {
                    boolean required = tool.requiredParameters().contains(p.getKey());
                    params.add(p.getKey() + (required ? "*" : "") + ": " + p.getValue());
                }
                line.append(" | params: ").append(params);
            }
            lines.add(line.toString());
        }
        return lines.toString();
    }
}
