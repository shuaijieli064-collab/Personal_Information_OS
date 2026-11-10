package com.signal.discover.dto;

/**
 * One verified source suggestion. There is deliberately no confidence percentage:
 * the LLM's self-score is decorative, the only trustable signal is {@code verified}
 * — the verifier actually fetched this URL and got an usable feed / repo JSON.
 */
public record SuggestionDto(String title, String url, String type, String reason) {}
