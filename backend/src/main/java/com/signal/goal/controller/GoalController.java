package com.signal.goal.controller;

import com.signal.common.ApiResponse;
import com.signal.goal.dto.GoalRequest;
import com.signal.goal.entity.Goal;
import com.signal.goal.service.GoalService;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/goals")
public class GoalController {

    private final GoalService service;

    public GoalController(GoalService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<Goal>> list() { return ApiResponse.ok(service.list(userId())); }

    @GetMapping("/{id}")
    public ApiResponse<Goal> get(@PathVariable UUID id) { return ApiResponse.ok(service.get(userId(), id)); }

    @PostMapping
    public ApiResponse<Goal> create(@Valid @RequestBody GoalRequest req) {
        return ApiResponse.ok(service.create(userId(), req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Goal> update(@PathVariable UUID id, @Valid @RequestBody GoalRequest req) {
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
