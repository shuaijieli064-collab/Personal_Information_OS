package com.signal.task;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on Spring's scheduler for {@link AutomationScheduler#tick()}. Kept as a tiny
 * dedicated configuration so scheduling can be reasoned about (and, if ever needed,
 * excluded) independently of the automation beans themselves.
 */
@Configuration
@EnableScheduling
public class AutomationConfig {
}
