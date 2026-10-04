package com.signal.ingestion.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "information")
public class Information {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    @Column(name = "source_item_id", nullable = false, unique = true)
    private UUID sourceItemId;

    @Column(nullable = false)
    private String type = "ARTICLE";

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String content;

    @Column(columnDefinition = "text")
    private String excerpt;

    private String url;
    private String author;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "content_hash", nullable = false)
    private String contentHash;

    private String language;

    @Column(columnDefinition = "text")
    private String metadata = "{}";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID v) { this.id = v; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public UUID getSourceId() { return sourceId; }
    public void setSourceId(UUID v) { this.sourceId = v; }
    public UUID getSourceItemId() { return sourceItemId; }
    public void setSourceItemId(UUID v) { this.sourceItemId = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public String getContent() { return content; }
    public void setContent(String v) { this.content = v; }
    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String v) { this.excerpt = v; }
    public String getUrl() { return url; }
    public void setUrl(String v) { this.url = v; }
    public String getAuthor() { return author; }
    public void setAuthor(String v) { this.author = v; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant v) { this.publishedAt = v; }
    public String getContentHash() { return contentHash; }
    public void setContentHash(String v) { this.contentHash = v; }
    public String getLanguage() { return language; }
    public void setLanguage(String v) { this.language = v; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String v) { this.metadata = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
