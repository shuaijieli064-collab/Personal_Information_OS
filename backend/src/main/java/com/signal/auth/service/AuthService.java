package com.signal.auth.service;

import com.signal.auth.dto.AuthResponse;
import com.signal.auth.dto.LoginRequest;
import com.signal.auth.dto.RegisterRequest;
import com.signal.auth.entity.RefreshToken;
import com.signal.auth.repository.RefreshTokenRepository;
import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.security.JwtService;
import com.signal.user.entity.User;
import com.signal.user.entity.UserProfile;
import com.signal.user.repository.UserProfileRepository;
import com.signal.user.repository.UserRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class AuthService {

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwt;

    public AuthService(UserRepository users, UserProfileRepository profiles,
                       RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder, JwtService jwt) {
        this.users = users;
        this.profiles = profiles;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwt = jwt;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.existsByEmail(email)) {
            throw new DuplicateResourceException("Email already registered");
        }
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setDisplayName(req.displayName() == null || req.displayName().isBlank()
                ? "SIGNAL User" : req.displayName().trim());
        users.save(u);

        UserProfile p = new UserProfile();
        p.setUserId(u.getId());
        profiles.save(p);

        return issueTokens(u);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User u = users.findByEmail(req.email().trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("bad creds"));
        if (!"ACTIVE".equals(u.getStatus())) {
            throw new BadCredentialsException("disabled");
        }
        if (!passwordEncoder.matches(req.password(), u.getPasswordHash())) {
            throw new BadCredentialsException("bad creds");
        }
        u.setLastLoginAt(Instant.now());
        users.save(u);
        return issueTokens(u);
    }

    /** Rotation: presented refresh must be unrevoked; old revoked, new issued. */
    @Transactional
    public AuthResponse refresh(String rawToken) {
        String jti;
        try {
            jti = jwt.jti(rawToken);
        } catch (Exception e) {
            throw new BadCredentialsException("invalid refresh token");
        }
        RefreshToken rt = refreshTokens.findByJti(jti)
                .orElseThrow(() -> new BadCredentialsException("unknown refresh token"));
        if (rt.getRevokedAt() != null || rt.getExpiresAt().isBefore(Instant.now())) {
            throw new BadCredentialsException("refresh token expired or revoked");
        }
        if (!sha256(rawToken).equals(rt.getTokenHash())) {
            throw new BadCredentialsException("refresh token mismatch");
        }
        rt.setRevokedAt(Instant.now());
        refreshTokens.save(rt);

        User u = users.findById(rt.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("user gone"));
        return issueTokens(u);
    }

    @Transactional
    public void logout(String rawToken) {
        try {
            refreshTokens.findByJti(jwt.jti(rawToken)).ifPresent(rt -> {
                rt.setRevokedAt(Instant.now());
                refreshTokens.save(rt);
            });
        } catch (Exception ignored) {}
    }

    private AuthResponse issueTokens(User u) {
        String access = jwt.generateAccessToken(u.getId());
        String refresh = jwt.generateRefreshToken(u.getId());

        RefreshToken rt = new RefreshToken();
        rt.setUserId(u.getId());
        rt.setJti(jwt.jti(refresh));
        rt.setTokenHash(sha256(refresh));
        rt.setExpiresAt(jwt.parseUserId(refresh) != null
                ? java.time.Instant.now().plusSeconds(604800) : Instant.now());
        refreshTokens.save(rt);

        return new AuthResponse(access, refresh,
                new AuthResponse.UserDto(u.getId(), u.getEmail(), u.getDisplayName()));
    }

    static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
