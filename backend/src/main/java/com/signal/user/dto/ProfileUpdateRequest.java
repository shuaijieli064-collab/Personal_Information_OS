package com.signal.user.dto;

import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @Size(max = 60) String displayName,
        @Size(max = 280) String bio,
        @Size(max = 10) String language,
        @Size(max = 40) String timezone) {}
