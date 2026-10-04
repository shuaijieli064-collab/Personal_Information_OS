package com.signal.signal.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_feedback")
public class UserFeedback {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "signal_id", nullable = false)
    private UUID signalId;

    @Column(nullable = false)
    private String type;

    @Column(columnDefinition = "text")
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public UUID getSignalId() { return signalId; }
    public void setSignalId(UUID v) { this.signalId = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public String getReason() { return reason; }
    public void setReason(String v) { this.reason = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
