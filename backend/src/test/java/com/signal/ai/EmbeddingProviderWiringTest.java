package com.signal.ai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Provider mutual exclusion (docs/ARCHITECTURE.md): real provider only with ai.api-key,
 * mock only without — never both, never @Primary.
 */
class EmbeddingProviderWiringTest {

    @Configuration(proxyBeanMethods = false)
    @Import({MockEmbeddingProvider.class, OpenAICompatibleEmbeddingProvider.class})
    static class EmbeddingConfig {
        @Bean
        AIProperties aiProperties() {
            return new AIProperties("test", "http://localhost:9", "chat-model", null, "", 500, 0);
        }
    }

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(EmbeddingConfig.class);

    @Test void mockSelectedWhenNoKey() {
        runner.run(ctx -> {
            var beans = ctx.getBeansOfType(EmbeddingProvider.class);
            assertEquals(1, beans.size(), "exactly one EmbeddingProvider expected");
            assertTrue(beans.values().iterator().next() instanceof MockEmbeddingProvider);
        });
    }

    @Test void realSelectedWhenKeyPresent() {
        runner.withPropertyValues("ai.api-key=test-key").run(ctx -> {
            var beans = ctx.getBeansOfType(EmbeddingProvider.class);
            assertEquals(1, beans.size(), "exactly one EmbeddingProvider expected");
            assertTrue(beans.values().iterator().next() instanceof OpenAICompatibleEmbeddingProvider);
        });
    }

    @Test void embeddingModelDefaultsWhenUnset() {
        AIProperties props = new AIProperties("p", "http://x", "m", "  ", "k", 0, 9);
        assertEquals("text-embedding-3-small", props.embeddingModel());
        assertEquals(3, props.maxRetries(), "retries capped at 3");
    }
}
