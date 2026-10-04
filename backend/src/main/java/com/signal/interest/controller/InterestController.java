package com.signal.interest.controller;

import com.signal.common.ApiResponse;
import com.signal.interest.dto.InterestRequest;
import com.signal.interest.entity.Interest;
import com.signal.interest.service.InterestService;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/interests")
public class InterestController {

    private final InterestService service;

    public InterestController(InterestService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<Interest>> list() { return ApiResponse.ok(service.list(userId())); }

    @PostMapping
    public ApiResponse<Interest> create(@Valid @RequestBody InterestRequest req) {
        return ApiResponse.ok(service.create(userId(), req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Interest> update(@PathVariable UUID id, @Valid @RequestBody InterestRequest req) {
        return ApiResponse.ok(service.update(userId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(userId(), id);
        return ApiResponse.ok(null);
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
