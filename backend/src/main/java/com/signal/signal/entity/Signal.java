package com.signal.signal.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "signals")
public class Signal {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "cluster_id")
    private UUID clusterId;

    @Column(name = "information_id", nullable = false, unique = true)
    private UUID informationId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String summary;

    @Column(name = "signal_score")
    private Double signalScore;

    @Column(name = "why_it_matters", columnDefinition = "text")
    private String whyItMatters;

    private String urgency;

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public UUID getClusterId() { return clusterId; }
    public void setClusterId(UUID v) { this.clusterId = v; }
    public UUID getInformationId() { return informationId; }
    public void setInformationId(UUID v) { this.informationId = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public String getSummary() { return summary; }
    public void setSummary(String v) { this.summary = v; }
    public Double getSignalScore() { return signalScore; }
    public void setSignalScore(Double v) { this.signalScore = v; }
    public String getWhyItMatters() { return whyItMatters; }
    public void setWhyItMatters(String v) { this.whyItMatters = v; }
    public String getUrgency() { return urgency; }
    public void setUrgency(String v) { this.urgency = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
