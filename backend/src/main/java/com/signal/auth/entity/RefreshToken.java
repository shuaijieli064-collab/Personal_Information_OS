package com.signal.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, unique = true)
    private String jti;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getJti() { return jti; }
    public void setJti(String jti) { this.jti = jti; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String h) { this.tokenHash = h; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant t) { this.expiresAt = t; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant t) { this.revokedAt = t; }
}
