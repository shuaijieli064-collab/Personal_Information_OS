package com.signal.ai.agent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One step of an agent run. The row is updated as the step progresses, never deleted. */
@Entity
@Table(name = "agent_steps")
public class AgentStep {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(nullable = false)
    private int seq;

    @Column(name = "tool_name", columnDefinition = "text")
    private String toolName;

    @Column(columnDefinition = "text")
    private String permission;

    @Column(columnDefinition = "text")
    private String arguments;

    @Column(columnDefinition = "text")
    private String result;

    @Column(nullable = false)
    private String status;

    @Column(columnDefinition = "text")
    private String rationale;

    @Column(columnDefinition = "text")
    private String error;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID v) { this.id = v; }
    public UUID getRunId() { return runId; }
    public void setRunId(UUID v) { this.runId = v; }
    public int getSeq() { return seq; }
    public void setSeq(int v) { this.seq = v; }
    public String getToolName() { return toolName; }
    public void setToolName(String v) { this.toolName = v; }
    public String getPermission() { return permission; }
    public void setPermission(String v) { this.permission = v; }
    public String getArguments() { return arguments; }
    public void setArguments(String v) { this.arguments = v; }
    public String getResult() { return result; }
    public void setResult(String v) { this.result = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public String getRationale() { return rationale; }
    public void setRationale(String v) { this.rationale = v; }
    public String getError() { return error; }
    public void setError(String v) { this.error = v; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { this.startedAt = v; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant v) { this.finishedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
}
