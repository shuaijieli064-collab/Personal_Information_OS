package com.signal.task.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One scheduled job per (user, type). The scheduler is driven entirely off this table:
 * it sweeps rows that are {@code enabled} and due, runs them, and rewrites
 * {@code next_run_at} and {@code consecutive_failures} to encode the retry / backoff /
 * dead-letter policy.
 */
@Entity
@Table(name = "scheduled_jobs")
public class ScheduledJob {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String type;

    @Column(name = "interval_minutes", nullable = false)
    private int intervalMinutes;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "next_run_at", nullable = false)
    private Instant nextRunAt;

    @Column(name = "consecutive_failures", nullable = false)
    private int consecutiveFailures;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID v) { this.id = v; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public int getIntervalMinutes() { return intervalMinutes; }
    public void setIntervalMinutes(int v) { this.intervalMinutes = v; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean v) { this.enabled = v; }
    public Instant getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(Instant v) { this.lastRunAt = v; }
    public Instant getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(Instant v) { this.nextRunAt = v; }
    public int getConsecutiveFailures() { return consecutiveFailures; }
    public void setConsecutiveFailures(int v) { this.consecutiveFailures = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
