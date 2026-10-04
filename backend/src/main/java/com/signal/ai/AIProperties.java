package com.signal.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ai")
public record AIProperties(
        String provider,
        String baseUrl,
        String model,
        String apiKey,
        int timeoutMs,
        int maxRetries) {

    public AIProperties {
        if (timeoutMs <= 0) timeoutMs = 20000;
        if (maxRetries < 0) maxRetries = 0;
        if (maxRetries > 3) maxRetries = 3; // bounded — no infinite retries
    }
}
