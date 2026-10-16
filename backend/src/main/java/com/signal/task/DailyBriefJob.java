package com.signal.task;

import com.signal.brief.BriefService;
import com.signal.brief.dto.NotificationDto;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Scheduled daily brief: delegates to {@link BriefService}, which owns the generation
 * (top signals + counts → one model call with a deterministic fallback) and the
 * persistence as a DAILY_BRIEF notification.
 */
@Component
public class DailyBriefJob {

    private final BriefService briefs;

    public DailyBriefJob(BriefService briefs) {
        this.briefs = briefs;
    }

    public String run(UUID userId) {
        NotificationDto brief = briefs.generate(userId);
        return "Daily brief generated: " + brief.title();
    }
}
