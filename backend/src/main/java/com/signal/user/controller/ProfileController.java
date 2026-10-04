package com.signal.user.controller;

import com.signal.common.ApiResponse;
import com.signal.user.dto.ProfileUpdateRequest;
import com.signal.user.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> get() {
        return ApiResponse.ok(service.get(userId()));
    }

    @PatchMapping
    public ApiResponse<Map<String, Object>> update(@Valid @RequestBody ProfileUpdateRequest req) {
        return ApiResponse.ok(service.update(userId(), req));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
