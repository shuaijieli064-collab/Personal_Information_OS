package com.signal.common;

import java.time.Instant;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 2 connectivity check: proves Frontend <-> Backend HTTP wiring works.
 * No business logic lives here.
 */
@RestController
@RequestMapping("/api/v1")
public class PingController {

    @Value("${spring.application.name}")
    private String appName;

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of(
                "success", true,
                "data", Map.of(
                        "app", appName,
                        "ts", Instant.now().toString(),
                        "message", "pong from SIGNAL backend"));
    }
}
