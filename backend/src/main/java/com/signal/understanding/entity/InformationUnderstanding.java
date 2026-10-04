package com.signal.understanding.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "information_understanding")
public class InformationUnderstanding {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "information_id", nullable = false, unique = true)
    private UUID informationId;

    private String language;

    @Column(name = "content_type")
    private String contentType;

    private String classification;

    private Double confidence;

    @Column(name = "relevance_score")
    private Double relevanceScore;

    @Column(name = "why_relevant", columnDefinition = "text")
    private String whyRelevant;

    @Column(name = "signal_score")
    private Double signalScore;

    @Column(name = "score_factors", columnDefinition = "text")
    private String scoreFactors = "{}";

    @Column(columnDefinition = "text")
    private String topics = "[]";

    @Column(columnDefinition = "text")
    private String entities = "[]";

    @Column(columnDefinition = "text")
    private String summary;

    @Column(name = "key_points", columnDefinition = "text")
    private String keyPoints = "[]";

    @Column(name = "understanding_status", nullable = false)
    private String status = "PENDING";

    private String model;

    @Column(name = "model_version")
    private String modelVersion;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public UUID getInformationId() { return informationId; }
    public void setInformationId(UUID v) { this.informationId = v; }
    public String getLanguage() { return language; }
    public void setLanguage(String v) { this.language = v; }
    public String getContentType() { return contentType; }
    public void setContentType(String v) { this.contentType = v; }
    public String getClassification() { return classification; }
    public void setClassification(String v) { this.classification = v; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double v) { this.confidence = v; }
    public Double getRelevanceScore() { return relevanceScore; }
    public void setRelevanceScore(Double v) { this.relevanceScore = v; }
    public String getWhyRelevant() { return whyRelevant; }
    public void setWhyRelevant(String v) { this.whyRelevant = v; }
    public Double getSignalScore() { return signalScore; }
    public void setSignalScore(Double v) { this.signalScore = v; }
    public String getScoreFactors() { return scoreFactors; }
    public void setScoreFactors(String v) { this.scoreFactors = v; }
    public String getTopics() { return topics; }
    public void setTopics(String v) { this.topics = v; }
    public String getEntities() { return entities; }
    public void setEntities(String v) { this.entities = v; }
    public String getSummary() { return summary; }
    public void setSummary(String v) { this.summary = v; }
    public String getKeyPoints() { return keyPoints; }
    public void setKeyPoints(String v) { this.keyPoints = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public String getModel() { return model; }
    public void setModel(String v) { this.model = v; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String v) { this.modelVersion = v; }
    public Instant getProcessedAt() { return processedAt; }
    public void setProcessedAt(Instant v) { this.processedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
