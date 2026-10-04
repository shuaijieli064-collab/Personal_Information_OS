package com.signal.auth.dto;

import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserDto user) {

    public record UserDto(UUID id, String email, String displayName) {}
}
