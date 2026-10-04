package com.signal.ingestion.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "source_items")
public class SourceItem {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    @Column(name = "external_id")
    private String externalId;

    private String url;

    @Column(name = "url_hash", nullable = false)
    private String urlHash;

    @Column(nullable = false)
    private String title;

    private String author;

    @Column(name = "content_text")
    private String contentText;

    @Column(name = "content_hash", nullable = false)
    private String contentHash;

    private String lang;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt = Instant.now();

    @Column(columnDefinition = "text")
    private String raw = "{}";

    public UUID getId() { return id; }
    public UUID getSourceId() { return sourceId; }
    public void setSourceId(UUID v) { this.sourceId = v; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String v) { this.externalId = v; }
    public String getUrl() { return url; }
    public void setUrl(String v) { this.url = v; }
    public String getUrlHash() { return urlHash; }
    public void setUrlHash(String v) { this.urlHash = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public String getAuthor() { return author; }
    public void setAuthor(String v) { this.author = v; }
    public String getContentText() { return contentText; }
    public void setContentText(String v) { this.contentText = v; }
    public String getContentHash() { return contentHash; }
    public void setContentHash(String v) { this.contentHash = v; }
    public String getLang() { return lang; }
    public void setLang(String v) { this.lang = v; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant v) { this.publishedAt = v; }
    public Instant getFetchedAt() { return fetchedAt; }
    public void setFetchedAt(Instant v) { this.fetchedAt = v; }
    public String getRaw() { return raw; }
    public void setRaw(String v) { this.raw = v; }
}
