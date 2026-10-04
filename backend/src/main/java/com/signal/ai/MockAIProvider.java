package com.signal.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

/** Used in tests / when no real AI key configured. */
@Component
@ConditionalOnExpression("'${ai.api-key:}' == ''")
public class MockAIProvider implements AIProvider {

    @Override public String name() { return "mock"; }

    @Override
    public String chat(ChatRequest request) {
        return "mock response";
    }

    @Override
    public String structuredOutput(ChatRequest request) {
        return "{\"result\": \"mock\"}";
    }
}
