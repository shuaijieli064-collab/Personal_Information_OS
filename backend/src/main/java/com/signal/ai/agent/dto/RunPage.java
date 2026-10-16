package com.signal.ai.agent.dto;

import java.util.List;

/** Paged list of runs (newest first), without steps. */
public record RunPage(List<RunDto> items, long total) {}
