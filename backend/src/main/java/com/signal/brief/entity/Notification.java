package com.signal.brief.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One entry in the user's inbox. The daily brief, important-signal alerts and job
 * failures all land here, so the UI has a single feed to poll instead of three.
 *
 * <p>{@code payload} is JSON text (there is no jsonb mapping in this codebase). It is
 * the dedupe key for {@code IMPORTANT_SIGNAL}: the signal id lives inside it, and the
 * service refuses to raise a second notification for a signal already announced.
 */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(columnDefinition = "text")
    private String body;

    @Column(name = "read", nullable = false)
    private boolean read = false;

    @Column(columnDefinition = "text")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID v) { this.id = v; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public String getBody() { return body; }
    public void setBody(String v) { this.body = v; }
    public boolean isRead() { return read; }
    public void setRead(boolean v) { this.read = v; }
    public String getPayload() { return payload; }
    public void setPayload(String v) { this.payload = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
}
