package com.signal.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Stand-in used when no re-ranking credentials are configured (dev / tests).
 *
 * <p>Reports {@link #available()} = {@code false} so the search layer skips the
 * re-rank step and returns retrieval order untouched — no wasted call, no fake scores.
 * Mutual exclusion with {@link DashScopeRerankProvider} via the api-key conditions.
 */
@Component
@ConditionalOnExpression("'${ai.rerank-api-key:}' == '' && '${ai.embedding-api-key:}' == '' && '${ai.api-key:}' == ''")
public class NoopRerankProvider implements RerankProvider {

    @Override
    public List<RerankHit> rerank(String query, List<String> documents, int topN) {
        return List.of();
    }

    @Override
    public String model() {
        return "noop-rerank";
    }

    @Override
    public boolean available() {
        return false;
    }
}
