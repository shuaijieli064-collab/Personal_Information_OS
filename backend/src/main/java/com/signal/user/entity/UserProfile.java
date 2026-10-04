package com.signal.user.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
public class UserProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    private String bio;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(nullable = false)
    private String language = "zh-CN";

    @Column(nullable = false)
    private String timezone = "Asia/Shanghai";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getUserId() { return userId; }
    public void setUserId(UUID id) { this.userId = id; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String u) { this.avatarUrl = u; }
    public String getLanguage() { return language; }
    public void setLanguage(String l) { this.language = l; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String t) { this.timezone = t; }
}
