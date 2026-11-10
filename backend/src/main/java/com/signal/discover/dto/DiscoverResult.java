package com.signal.discover.dto;

import java.util.List;

/**
 * The suggest response. {@code fallback} is null on the happy path; on degradation
 * (AI unconfigured / model call failed / unparseable answer) it names the fallback so
 * the UI can honestly label what it shows instead — never a silent fake recommendation.
 */
public record DiscoverResult(List<SuggestionDto> suggestions, String fallback) {}
