package com.signal.ai.agent;

import com.signal.ai.AIProvider;
import com.signal.ai.ChatMessage;
import com.signal.ai.PromptBoundary;
import com.signal.ai.agent.dto.RunDto;
import com.signal.ai.agent.dto.RunPage;
import com.signal.ai.agent.dto.StepDto;
import com.signal.ai.tools.AgentTool;
import com.signal.ai.tools.ToolRegistry;
import com.signal.common.exceptions.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.StringJoiner;
import java.util.UUID;

/**
 * Orchestrates an agent run end to end: plan → execute (with the permission gate) →
 * summarise, persisting the run and every step as an audit trail.
 *
 * <p><b>Degradation</b> is a house rule here too:
 * <ul>
 *   <li>Planning failures are handled inside {@link AgentPlanner} (fallback plan).</li>
 *   <li>If the final summary call fails, the run still completes with a deterministic
 *       rendering of the step results — a run is never left without an answer.</li>
 *   <li>Tool failures are recorded per step; the run continues.</li>
 * </ul>
 *
 * <p>No class-level {@code @Transactional}: planning and tool execution make network calls,
 * and a DB transaction must not be held across them (same reasoning as
 * {@code IngestionService}). Each repository write is its own short transaction.
 */
@Service
public class AgentRunService {

    private static final Logger log = LoggerFactory.getLogger(AgentRunService.class);

    /** Hard upper bound on requested steps, regardless of what the client asks for. */
    static final int MAX_STEPS = 10;

    private final AgentPlanner planner;
    private final AgentExecutor executor;
    private final AgentRunRepository runs;
    private final AgentStepRepository steps;
    private final ToolRegistry registry;
    private final AIProvider ai;
    private final int defaultMaxSteps;

    public AgentRunService(AgentPlanner planner, AgentExecutor executor,
                           AgentRunRepository runs, AgentStepRepository steps,
                           ToolRegistry registry, AIProvider ai,
                           @Value("${app.agent.max-steps:6}") int defaultMaxSteps) {
        this.planner = planner;
        this.executor = executor;
        this.runs = runs;
        this.steps = steps;
        this.registry = registry;
        this.ai = ai;
        this.defaultMaxSteps = defaultMaxSteps;
    }

    /** Plans and runs a goal for the caller, pausing at the first WRITE step if any. */
    public RunDto createRun(UUID userId, String goal, Integer maxSteps) {
        int cap = clampSteps(maxSteps);

        AgentRun run = new AgentRun();
        run.setUserId(userId);
        run.setGoal(goal == null ? "" : goal.trim());
        run.setStatus(AgentRunStatus.PLANNING.name());
        run.setModel(ai.name());
        run = runs.save(run);

        AgentPlanner.Plan plan = planner.plan(run.getGoal(), cap);
        List<AgentStep> stepEntities = materialise(run, plan);
        stepEntities = steps.saveAll(stepEntities);

        executor.execute(userId, run, stepEntities);

        if (!AgentRunStatus.AWAITING_CONFIRMATION.name().equals(run.getStatus())) {
            finish(run, stepEntities);
        }
        run.setUpdatedAt(Instant.now());
        runs.save(run);
        steps.saveAll(stepEntities);
        return toDto(run, stepEntities);
    }

    public RunDto getRun(UUID userId, UUID runId) {
        AgentRun run = load(userId, runId);
        return toDto(run, steps.findByRunIdOrderBySeqAsc(run.getId()));
    }

    /** Newest-first page of the caller's runs, without steps. */
    public RunPage listRuns(UUID userId, int page, int size) {
        int p = Math.max(0, page);
        int s = Math.min(Math.max(size, 1), 100);
        Page<AgentRun> result = runs.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(p, s));
        List<RunDto> items = result.getContent().stream()
                .map(r -> toDto(r, List.of()))
                .toList();
        return new RunPage(items, result.getTotalElements());
    }

    /** Confirms the pending step and continues the run. */
    public RunDto confirm(UUID userId, UUID runId, UUID stepId, String note) {
        AgentRun run = load(userId, runId);
        List<AgentStep> stepEntities = steps.findByRunIdOrderBySeqAsc(run.getId());

        AgentStep pending = pendingStep(stepEntities, stepId);
        executor.confirm(userId, run, stepEntities, stepId);

        if (pending != null && note != null && !note.isBlank()) {
            pending.setRationale(appendNote(pending.getRationale(), note.trim()));
        }
        if (!AgentRunStatus.AWAITING_CONFIRMATION.name().equals(run.getStatus())) {
            finish(run, stepEntities);
        }
        run.setUpdatedAt(Instant.now());
        runs.save(run);
        steps.saveAll(stepEntities);
        return toDto(run, stepEntities);
    }

    /** Rejects the pending step and the run. */
    public RunDto reject(UUID userId, UUID runId, String reason) {
        AgentRun run = load(userId, runId);
        List<AgentStep> stepEntities = steps.findByRunIdOrderBySeqAsc(run.getId());
        executor.reject(run, stepEntities, null, reason);
        run.setUpdatedAt(Instant.now());
        runs.save(run);
        steps.saveAll(stepEntities);
        return toDto(run, stepEntities);
    }

    // ── internals ───────────────────────────────────────────────────────────────

    private AgentRun load(UUID userId, UUID runId) {
        return runs.findByIdAndUserId(runId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Agent run not found"));
    }

    /** Turns a plan into persisted step rows (PLANNED), skipping tools not in the catalogue. */
    private List<AgentStep> materialise(AgentRun run, AgentPlanner.Plan plan) {
        List<AgentStep> out = new ArrayList<>();
        int seq = 1;
        for (AgentPlanner.PlannedStep planned : plan.steps()) {
            Optional<AgentTool> tool = registry.find(planned.tool());
            if (tool.isEmpty()) continue;
            AgentStep step = new AgentStep();
            step.setRunId(run.getId());
            step.setSeq(seq++);
            step.setToolName(tool.get().name());
            step.setPermission(tool.get().permission().name());
            step.setArguments(AgentJson.toText(planned.arguments()));
            step.setRationale(planned.rationale());
            step.setStatus(AgentStepStatus.PLANNED.name());
            out.add(step);
        }
        return out;
    }

    /**
     * Produces the run's final answer and marks it COMPLETED. The LLM summary is best-effort:
     * if it fails, the deterministic rendering stands in, so the run always has an answer.
     */
    private void finish(AgentRun run, List<AgentStep> steps) {
        String answer = null;
        try {
            answer = synthesize(run.getGoal(), steps);
        } catch (Exception e) {
            log.warn("Agent answer synthesis failed, using deterministic summary: {}", e.toString());
        }
        if (answer == null || answer.isBlank()) answer = render(steps);
        run.setAnswer(answer);
        run.setStatus(AgentRunStatus.COMPLETED.name());
    }

    private String synthesize(String goal, List<AgentStep> steps) {
        List<ChatMessage> messages = PromptBoundary
                .system("You are a helpful assistant. Summarise the tool observations below into a "
                        + "plain-language answer to the user's goal. Use ONLY the observations; never "
                        + "invent facts. If a step failed, mention it honestly. "
                        + "Answer in the same language as the goal.")
                .untrustedInformation(observations(steps))
                .question(goal == null ? "" : goal)
                .build();
        String answer = ai.chat(new AIProvider.ChatRequest(messages, 0.2));
        return answer == null ? null : answer.trim();
    }

    /** Detailed, honest rendering of the steps for the summariser. */
    private static String observations(List<AgentStep> steps) {
        if (steps.isEmpty()) return "No tools were run.";
        StringBuilder sb = new StringBuilder();
        for (AgentStep s : steps) {
            sb.append("Step ").append(s.getSeq()).append(" ").append(s.getToolName())
                    .append(" [").append(s.getStatus()).append("]\n");
            if (s.getResult() != null) sb.append("result: ").append(s.getResult()).append('\n');
            if (s.getError() != null) sb.append("error: ").append(s.getError()).append('\n');
        }
        return sb.toString().trim();
    }

    /** Deterministic fallback answer built from the step outcomes. */
    static String render(List<AgentStep> steps) {
        if (steps.isEmpty()) return "No tools were run.";
        StringJoiner joiner = new StringJoiner("; ");
        for (AgentStep s : steps) {
            String part = s.getToolName() + " (" + s.getStatus() + ")";
            if (AgentStepStatus.FAILED.name().equals(s.getStatus()) && s.getError() != null) {
                part += ": " + s.getError();
            }
            joiner.add(part);
        }
        return "Ran " + steps.size() + (steps.size() == 1 ? " tool: " : " tools: ") + joiner + ".";
    }

    private static AgentStep pendingStep(List<AgentStep> steps, UUID stepId) {
        for (AgentStep step : steps) {
            if (!AgentStepStatus.PENDING_CONFIRMATION.name().equals(step.getStatus())) continue;
            if (stepId == null || stepId.equals(step.getId())) return step;
        }
        return null;
    }

    private static String appendNote(String rationale, String note) {
        return (rationale == null || rationale.isBlank())
                ? "[confirmed] " + note
                : rationale + "\n[confirmed] " + note;
    }

    /** Clamps a requested step count to [1, {@value #MAX_STEPS}]; null → the configured default. */
    int clampSteps(Integer maxSteps) {
        if (maxSteps == null) return Math.max(1, Math.min(defaultMaxSteps, MAX_STEPS));
        return Math.max(1, Math.min(maxSteps, MAX_STEPS));
    }

    static RunDto toDto(AgentRun run, List<AgentStep> steps) {
        List<StepDto> stepDtos = steps.stream().map(AgentRunService::toStepDto).toList();
        return new RunDto(run.getId(), run.getGoal(), run.getStatus(), run.getAnswer(),
                run.getModel(), run.getError(), run.getCreatedAt(), run.getUpdatedAt(), stepDtos);
    }

    static StepDto toStepDto(AgentStep step) {
        return new StepDto(step.getId(), step.getSeq(), step.getToolName(), step.getPermission(),
                step.getStatus(), AgentJson.parse(step.getArguments()), AgentJson.parse(step.getResult()),
                step.getRationale(), step.getError(), step.getStartedAt(), step.getFinishedAt());
    }
}
