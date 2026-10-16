package com.signal.brief.dto;

/**
 * Envelope for the brief endpoints. {@code brief} is {@code null} when the user has no
 * brief yet — an empty brief is not an error, so the endpoint never 404s.
 */
public record BriefResponse(NotificationDto brief) {}
