package com.signal.ai.agent;

import com.signal.ai.AIProvider;
import com.signal.ai.ChatMessage;
import com.signal.ai.PromptBoundary;
import com.signal.ai.tools.AgentTool;
import com.signal.ai.tools.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Turns a goal + the tool catalogue into an ordered plan, in a single structured call.
 *
 * <p>The catalogue (our own, trusted text) travels in the SYSTEM channel; the goal — the
 * caller's own request, which may embed pasted content — travels in the QUESTION channel,
 * so nothing the user writes can masquerade as an instruction to the planner.
 *
 * <p><b>Degradation</b> is mandatory: an LLM outage or unusable output must not fail the
 * request. Planning falls back to a deterministic single step
 * {@code askKnowledge(goal)} — the one thing that always helps.
 */
@Component
public class AgentPlanner {

    private static final Logger log = LoggerFactory.getLogger(AgentPlanner.class);

    /** The tool used when planning is impossible: answer straight from the knowledge base. */
    static final String FALLBACK_TOOL = "askKnowledge";

    private final AIProvider ai;
    private final ToolRegistry registry;
    private final int maxPlanSteps;

    public AgentPlanner(AIProvider ai, ToolRegistry registry,
                        @Value("${app.agent.max-plan-steps:10}") int maxPlanSteps) {
        this.ai = ai;
        this.registry = registry;
        this.maxPlanSteps = maxPlanSteps;
    }

    /** One planned tool call: what to run, with what arguments, and why. */
    public record PlannedStep(String tool, Map<String, Object> arguments, String rationale) {}

    public record Plan(List<PlannedStep> steps) {}

    /**
     * Plans for {@code goal}, capped at {@code maxSteps} (and at {@code app.agent.max-plan-steps}).
     * Never throws: on any failure it returns the deterministic fallback plan.
     */
    public Plan plan(String goal, int maxSteps) {
        int cap = Math.max(1, Math.min(maxSteps, maxPlanSteps));
        try {
            List<ChatMessage> messages = PromptBoundary
                    .system(instructions(cap))
                    .question(goal == null ? "" : goal)
                    .build();
            String raw = ai.structuredOutput(new AIProvider.ChatRequest(messages, 0.0));
            Plan parsed = parse(raw, cap);
            if (parsed != null) {
                return new Plan(keepKnownTools(parsed.steps()));
            }
            log.warn("Agent planner returned unusable output, falling back to {}", FALLBACK_TOOL);
        } catch (Exception e) {
            log.warn("Agent planning failed, falling back to {}: {}", FALLBACK_TOOL, e.toString());
        }
        return fallback(goal);
    }

    private String instructions(int cap) {
        return "You are a planning agent for a personal information assistant. "
                + "Given a goal, choose an ordered list of tools to run to make progress on it. "
                + "Use at most " + cap + " step(s). Use ONLY tools from this catalogue:\n"
                + registry.describe() + "\n"
                + "READ tools gather information and run immediately. "
                + "WRITE tools change state and will require the user's explicit confirmation. "
                + "Prefer the fewest steps that answer the goal. "
                + "If the goal needs no tools, return an empty steps array. "
                + "Return JSON only: "
                + "{\"steps\":[{\"tool\":\"<name>\",\"arguments\":{<arg>:<value>},\"rationale\":\"<why>\"}]}";
    }

    /**
     * Parses the model's JSON defensively. Returns {@code null} (→ fallback) when the output
     * is absent, unparseable, or not an object with a {@code steps} array. Individual bad
     * steps are dropped rather than failing the whole plan.
     */
    static Plan parse(String raw, int cap) {
        if (raw == null || raw.isBlank()) return null;
        JsonNode root;
        try {
            root = AgentJson.JSON.readTree(raw.trim());
        } catch (Exception e) {
            return null; // promised JSON, garbage arrived
        }
        if (root == null || !root.isObject()) return null;
        JsonNode stepsNode = root.path("steps");
        if (!stepsNode.isArray()) return null; // no usable plan

        List<PlannedStep> steps = new ArrayList<>();
        for (JsonNode node : stepsNode) {
            if (steps.size() >= cap) break;
            if (!node.isObject()) continue;
            String tool = node.path("tool").asText("").trim();
            if (tool.isEmpty()) continue;

            Map<String, Object> arguments = new LinkedHashMap<>();
            if (node.has("arguments")) {
                JsonNode argsNode = node.path("arguments");
                if (argsNode.isObject()) {
                    for (Map.Entry<String, JsonNode> e : argsNode.properties()) {
                        arguments.put(e.getKey(), AgentJson.toJava(e.getValue()));
                    }
                } else if (!argsNode.isNull()) {
                    continue; // malformed arguments (e.g. a bare string) — drop, never guess
                }
            }

            String rationale = node.path("rationale").asText("").trim();
            steps.add(new PlannedStep(tool, arguments, rationale.isEmpty() ? null : rationale));
        }
        return new Plan(steps);
    }

    /** Drops steps naming a tool that is not in the catalogue. */
    private List<PlannedStep> keepKnownTools(List<PlannedStep> steps) {
        List<PlannedStep> kept = new ArrayList<>(steps.size());
        for (PlannedStep step : steps) {
            Optional<AgentTool> tool = registry.find(step.tool());
            if (tool.isEmpty()) {
                log.warn("Agent planner proposed unknown tool '{}', dropping the step", step.tool());
                continue;
            }
            kept.add(step);
        }
        return kept;
    }

    /** Deterministic plan: answer the goal directly from the knowledge base. */
    private static Plan fallback(String goal) {
        Map<String, Object> args = new LinkedHashMap<>();
        args.put("question", goal == null ? "" : goal);
        return new Plan(List.of(new PlannedStep(FALLBACK_TOOL, args,
                "Fallback: answer the goal directly from the knowledge base.")));
    }
}
