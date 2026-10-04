package com.signal.user.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.user.dto.ProfileUpdateRequest;
import com.signal.user.entity.User;
import com.signal.user.entity.UserProfile;
import com.signal.user.repository.UserProfileRepository;
import com.signal.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class ProfileService {

    private final UserRepository users;
    private final UserProfileRepository profiles;

    public ProfileService(UserRepository users, UserProfileRepository profiles) {
        this.users = users;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UUID userId) {
        User u = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));
        UserProfile p = profiles.findById(userId).orElseGet(UserProfile::new);
        return Map.of(
                "displayName", u.getDisplayName() == null ? "" : u.getDisplayName(),
                "bio", p.getBio() == null ? "" : p.getBio(),
                "language", p.getLanguage(),
                "timezone", p.getTimezone(),
                "avatarUrl", p.getAvatarUrl() == null ? "" : p.getAvatarUrl());
    }

    @Transactional
    public Map<String, Object> update(UUID userId, ProfileUpdateRequest req) {
        User u = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));
        UserProfile p = profiles.findById(userId).orElseGet(UserProfile::new);
        p.setUserId(userId);

        if (req.displayName() != null) u.setDisplayName(req.displayName().trim());
        if (req.bio() != null) p.setBio(req.bio());
        if (req.language() != null) p.setLanguage(req.language());
        if (req.timezone() != null) p.setTimezone(req.timezone());
        users.save(u);
        profiles.save(p);
        return get(userId);
    }
}
