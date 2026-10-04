package com.signal.auth.controller;

import com.signal.auth.dto.AuthResponse;
import com.signal.auth.dto.LoginRequest;
import com.signal.auth.dto.RefreshRequest;
import com.signal.auth.dto.RegisterRequest;
import com.signal.auth.service.AuthService;
import com.signal.common.ApiResponse;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.user.entity.User;
import com.signal.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;
    private final UserRepository users;

    public AuthController(AuthService auth, UserRepository users) {
        this.auth = auth;
        this.users = users;
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ApiResponse.ok(auth.register(req));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(auth.login(req));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshRequest req) {
        return ApiResponse.ok(auth.refresh(req.refreshToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Map<String, Object>> logout(@RequestBody(required = false) RefreshRequest req) {
        if (req != null && req.refreshToken() != null) {
            auth.logout(req.refreshToken());
        }
        return ApiResponse.ok(Map.of("loggedOut", true));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me() {
        UUID userId = (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User u = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));
        return ApiResponse.ok(Map.of(
                "id", u.getId(),
                "email", u.getEmail(),
                "profile", Map.of("displayName", u.getDisplayName() == null ? "" : u.getDisplayName())
        ));
    }
}
