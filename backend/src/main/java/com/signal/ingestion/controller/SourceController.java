package com.signal.ingestion.controller;

import com.signal.common.ApiResponse;
import com.signal.ingestion.dto.SourceRequest;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.service.IngestionService;
import com.signal.ingestion.service.SourceService;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sources")
public class SourceController {

    private final SourceService service;
    private final IngestionService ingestion;

    public SourceController(SourceService service, IngestionService ingestion) {
        this.service = service;
        this.ingestion = ingestion;
    }

    @GetMapping
    public ApiResponse<List<Source>> list() { return ApiResponse.ok(service.list(userId())); }

    @GetMapping("/{id}")
    public ApiResponse<Source> get(@PathVariable UUID id) { return ApiResponse.ok(service.get(userId(), id)); }

    @PostMapping
    public ApiResponse<Source> create(@Valid @RequestBody SourceRequest req) {
        return ApiResponse.ok(service.create(userId(), req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Source> update(@PathVariable UUID id, @Valid @RequestBody SourceRequest req) {
        return ApiResponse.ok(service.update(userId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(userId(), id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/sync")
    public ApiResponse<IngestionService.SyncResult> sync(@PathVariable UUID id) {
        return ApiResponse.ok(ingestion.sync(userId(), id));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
