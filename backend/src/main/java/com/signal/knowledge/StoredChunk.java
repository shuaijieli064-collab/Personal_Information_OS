package com.signal.knowledge;

import java.util.List;

/** One chunk row ready for persistence. embedding may be null (provider failure → keyword leg still works). */
public record StoredChunk(int ordinal, String content, String model, List<Double> embedding) {}
