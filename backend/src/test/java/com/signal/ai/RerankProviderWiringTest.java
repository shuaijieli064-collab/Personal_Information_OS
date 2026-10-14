package com.signal.ai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Re-rank provider mutual exclusion (docs/ARCHITECTURE.md pattern): the DashScope adapter
 * is active whenever a re-rank key resolves, the no-op stand-in otherwise — never both.
 */
class RerankProviderWiringTest {

    @Configuration(proxyBeanMethods = false)
    @Import({NoopRerankProvider.class, DashScopeRerankProvider.class})
    static class RerankConfig {
        @Bean
        AIProperties aiProperties() {
            return new AIProperties("test", "http://localhost:9", "chat-model", "", null, "", "", 0,
                    null, "", "", 500, 0);
        }
    }

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(RerankConfig.class);

    @Test void noopSelectedWhenNoKey() {
        runner.run(ctx -> {
            var beans = ctx.getBeansOfType(RerankProvider.class);
            assertEquals(1, beans.size(), "exactly one RerankProvider expected");
            RerankProvider p = beans.values().iterator().next();
            assertTrue(p instanceof NoopRerankProvider);
            assertFalse(p.available(), "the no-op provider must report itself unavailable");
        });
    }

    @Test void realSelectedWhenRerankKeyPresent() {
        runner.withPropertyValues("ai.rerank-api-key=rk").run(ctx -> {
            var beans = ctx.getBeansOfType(RerankProvider.class);
            assertEquals(1, beans.size(), "exactly one RerankProvider expected");
            assertTrue(beans.values().iterator().next() instanceof DashScopeRerankProvider);
        });
    }

    @Test void realSelectedWhenOnlyEmbeddingKeyPresent() {
        runner.withPropertyValues("ai.embedding-api-key=ek").run(ctx -> {
            var beans = ctx.getBeansOfType(RerankProvider.class);
            assertEquals(1, beans.size(), "exactly one RerankProvider expected");
            assertTrue(beans.values().iterator().next() instanceof DashScopeRerankProvider);
        });
    }

    @Test void rerankCoordinatesDefaultToTheEmbeddingOnes() {
        AIProperties props = new AIProperties("p", "http://chat", "m", "chat-key",
                "emb-model", "http://emb", "emb-key", 1024,
                "  ", "  ", "  ", 0, 9);
        assertEquals(AIProperties.DEFAULT_RERANK_MODEL, props.rerankModel());
        assertEquals("http://emb", props.rerankBaseUrl(), "rerank base URL falls back to embeddings");
        assertEquals("emb-key", props.rerankApiKey(), "rerank key falls back to the embedding key");
        assertTrue(props.hasRerankKey());
    }
}
