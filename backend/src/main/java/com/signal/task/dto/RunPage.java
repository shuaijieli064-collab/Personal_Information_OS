package com.signal.task.dto;

import java.util.List;

/** Paged run history for one job, newest first. */
public record RunPage(List<RunDto> items, long total) {}
