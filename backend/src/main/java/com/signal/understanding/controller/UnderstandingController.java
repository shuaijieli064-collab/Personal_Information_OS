package com.signal.understanding.controller;

import com.signal.common.ApiResponse;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.service.InformationUnderstandingService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/information/{id}/understanding")
public class UnderstandingController {

    private final InformationUnderstandingService service;

    public UnderstandingController(InformationUnderstandingService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<InformationUnderstanding> get(@PathVariable UUID id) {
        return ApiResponse.ok(service.get(userId(), id));
    }

    @PostMapping
    public ApiResponse<InformationUnderstanding> process(@PathVariable UUID id) {
        return ApiResponse.ok(service.process(userId(), id));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
