package com.signal.ai;

import java.util.List;

/** Vendor-agnostic AI gateway. Business code depends ONLY on this interface. */
public interface AIProvider {

    record ChatRequest(List<ChatMessage> messages, double temperature) {}

    String chat(ChatRequest request);

    /** Request JSON output; the returned string MUST be parseable JSON (validated by caller layer). */
    String structuredOutput(ChatRequest request);

    String name();
}
