package com.signal.ingestion.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sources")
public class Source {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String type; // RSS / GITHUB / URL / FILE

    @Column(nullable = false)
    private String name;

    private String url;

    @Column(columnDefinition = "text")
    private String config = "{}";

    @Column(nullable = false)
    private String status = "ACTIVE"; // ACTIVE / PAUSED / ERROR / DISABLED

    private Boolean active = true;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getUrl() { return url; }
    public void setUrl(String v) { this.url = v; }
    public String getConfig() { return config; }
    public void setConfig(String v) { this.config = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean v) { this.active = v; }
    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Instant v) { this.lastSyncedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
