package com.signal.understanding.provider;

/** Abstraction so business code never binds to a specific LLM vendor. */
public interface InformationUnderstandingProvider {
    UnderstandingResult understand(String title, String content);
}
