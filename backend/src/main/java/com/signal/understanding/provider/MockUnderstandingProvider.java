package com.signal.understanding.provider;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Phase 5.1 stand-in: deterministic, heuristic-only. NO LLM call.
 * Real provider (LLM) arrives in a later phase behind this same interface.
 */
@Component
@ConditionalOnMissingBean(name = "realUnderstandingProvider")
public class MockUnderstandingProvider implements InformationUnderstandingProvider {

    @Override
    public UnderstandingResult understand(String title, String content) {
        String text = (content == null ? "" : content);
        String summary = text.length() > 200 ? text.substring(0, 200) : text;
        return new UnderstandingResult(
                "en",
                "article",
                "uncategorized",
                "[]",
                "[]",
                summary,
                "mock",
                "0.1");
    }
}
