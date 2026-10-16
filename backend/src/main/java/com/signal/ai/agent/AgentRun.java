package com.signal.ai.agent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One agent run — the goal, its outcome and the answer. Append-only in spirit. */
@Entity
@Table(name = "agent_runs")
public class AgentRun {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, columnDefinition = "text")
    private String goal;

    @Column(nullable = false)
    private String status;

    @Column(columnDefinition = "text")
    private String answer;

    private String model;

    @Column(columnDefinition = "text")
    private String error;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID v) { this.id = v; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public String getGoal() { return goal; }
    public void setGoal(String v) { this.goal = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public String getAnswer() { return answer; }
    public void setAnswer(String v) { this.answer = v; }
    public String getModel() { return model; }
    public void setModel(String v) { this.model = v; }
    public String getError() { return error; }
    public void setError(String v) { this.error = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
