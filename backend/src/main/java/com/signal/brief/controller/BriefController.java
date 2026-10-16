package com.signal.brief.controller;

import com.signal.brief.BriefService;
import com.signal.brief.dto.BriefResponse;
import com.signal.common.ApiResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Phase 8 brief API. {@code GET /latest} deliberately returns {@code {"brief": null}} for
 * an empty inbox-like resource — a missing brief is a normal state, not a 404.
 */
@RestController
@RequestMapping("/api/v1/brief")
public class BriefController {

    private final BriefService briefs;

    public BriefController(BriefService briefs) {
        this.briefs = briefs;
    }

    /** The most recent DAILY_BRIEF notification, or {@code {"brief": null}}. */
    @GetMapping("/latest")
    public ApiResponse<BriefResponse> latest() {
        return ApiResponse.ok(new BriefResponse(briefs.latest(userId())));
    }

    /** Generates a brief on demand and returns it. */
    @PostMapping("/generate")
    public ApiResponse<BriefResponse> generate() {
        return ApiResponse.ok(new BriefResponse(briefs.generate(userId())));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
