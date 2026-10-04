package com.signal.signal.controller;

import com.signal.common.ApiResponse;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/signals")
public class SignalController {

    private final SignalRepository repo;

    public SignalController(SignalRepository repo) { this.repo = repo; }

    @GetMapping
    public ApiResponse<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        size = Math.min(size, 100);
        var p = repo.findByUserIdOrderBySignalScoreDesc(userId(),
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        return ApiResponse.ok(Map.of("items", p.getContent(), "total", p.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Signal> get(@PathVariable UUID id) {
        return ApiResponse.ok(repo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Signal not found")));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Signal> patch(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        Signal s = repo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Signal not found"));
        if (body.containsKey("status")) s.setStatus(body.get("status"));
        s.setUpdatedAt(java.time.Instant.now());
        return ApiResponse.ok(repo.save(s));
    }

    @PostMapping("/{id}/save")
    public ApiResponse<Signal> save(@PathVariable UUID id) { return set(id, "SAVED"); }

    @PostMapping("/{id}/important")
    public ApiResponse<Signal> important(@PathVariable UUID id) { return set(id, "IMPORTANT"); }

    @PostMapping("/{id}/ignore")
    public ApiResponse<Signal> ignore(@PathVariable UUID id) { return set(id, "ARCHIVED"); }

    private ApiResponse<Signal> set(UUID id, String status) {
        Signal s = repo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Signal not found"));
        s.setStatus(status);
        s.setUpdatedAt(java.time.Instant.now());
        return ApiResponse.ok(repo.save(s));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
