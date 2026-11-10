package com.signal.discover;

import com.signal.common.ApiResponse;
import com.signal.discover.dto.DiscoverResult;
import com.signal.discover.dto.SuggestRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * The discover API. The request is the user's own words about what they want to follow;
 * the answer carries only live-verified candidates or a labelled fallback — never a
 * fabricated recommendation.
 */
@RestController
@RequestMapping("/api/v1/discover")
public class DiscoverController {

    private final DiscoverService service;

    public DiscoverController(DiscoverService service) {
        this.service = service;
    }

    @PostMapping("/suggest")
    public ApiResponse<DiscoverResult> suggest(@Valid @RequestBody SuggestRequest request) {
        return ApiResponse.ok(service.suggest(userId(), request.query(), request.limit()));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
