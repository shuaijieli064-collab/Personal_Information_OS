package com.signal.ingestion.controller;

import com.signal.common.ApiResponse;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/information")
public class InformationController {

    private final InformationRepository repo;

    public InformationController(InformationRepository repo) { this.repo = repo; }

    @GetMapping
    public ApiResponse<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        size = Math.min(Math.max(size, 1), 100);
        Page<Information> p = repo.findByUserId(userId(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "publishedAt", "createdAt")));
        return ApiResponse.ok(Map.of(
                "items", p.getContent(), "page", p.getNumber(), "size", p.getSize(),
                "total", p.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Information> get(@PathVariable UUID id) {
        Information info = repo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
        return ApiResponse.ok(info);
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
