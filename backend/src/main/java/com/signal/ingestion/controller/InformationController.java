package com.signal.ingestion.controller;

import com.signal.common.ApiResponse;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/information")
public class InformationController {

    /** Triage states. ACTIVE and ARCHIVED predate the inbox; KEPT is the explicit "keep". */
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_KEPT = "KEPT";
    private static final String STATUS_ARCHIVED = "ARCHIVED";

    private final InformationRepository repo;
    private final SignalRepository signals;

    public InformationController(InformationRepository repo, SignalRepository signals) {
        this.repo = repo;
        this.signals = signals;
    }

    /**
     * The inbox feed. {@code status} narrows it to one triage state — the client asks for
     * ACTIVE to fill "needs review" and ARCHIVED to fill "ignored".
     *
     * <p>{@code signalIds} maps information id → signal id for the rows on this page, so the
     * client can offer "view signal" instead of "analyse" on something already analysed. It
     * is a read-only lookup across modules, not a write dependency.
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        size = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "publishedAt", "createdAt"));
        List<String> wanted = parseStatuses(status);
        Page<Information> p;
        if (wanted.isEmpty()) {
            p = repo.findByUserId(userId(), pageable);
        } else if (wanted.size() == 1) {
            p = repo.findByUserIdAndStatus(userId(), wanted.get(0), pageable);
        } else {
            p = repo.findByUserIdAndStatusIn(userId(), wanted, pageable);
        }

        List<UUID> ids = p.getContent().stream().map(Information::getId).toList();
        Map<String, String> signalIds = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Signal s : signals.findByInformationIdIn(ids)) {
                signalIds.put(s.getInformationId().toString(), s.getId().toString());
            }
        }

        Map<String, Object> body = new HashMap<>();
        body.put("items", p.getContent());
        body.put("page", p.getNumber());
        body.put("size", p.getSize());
        body.put("total", p.getTotalElements());
        body.put("signalIds", signalIds);
        return ApiResponse.ok(body);
    }

    /**
     * Comma-separated triage states, so the client can ask for "ACTIVE,KEPT" — the review
     * list — in one request. Unknown tokens are a client error, not a silent empty feed.
     */
    private static List<String> parseStatuses(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        List<String> allowed = List.of(STATUS_ACTIVE, STATUS_KEPT, STATUS_ARCHIVED);
        List<String> out = new java.util.ArrayList<>();
        for (String part : raw.split(",")) {
            String s = part.trim().toUpperCase();
            if (s.isEmpty()) continue;
            if (!allowed.contains(s)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "unknown status: " + s);
            }
            if (!out.contains(s)) out.add(s);
        }
        return out;
    }

    @GetMapping("/{id}")
    public ApiResponse<Information> get(@PathVariable UUID id) {
        Information info = repo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
        return ApiResponse.ok(info);
    }

    /** The triage decision, persisted. Idempotent: setting the same status twice is fine. */
    public record StatusPatch(
            @NotBlank
            @Pattern(regexp = STATUS_ACTIVE + "|" + STATUS_KEPT + "|" + STATUS_ARCHIVED,
                    message = "must be ACTIVE, KEPT or ARCHIVED")
            String status) {}

    @PatchMapping("/{id}")
    public ApiResponse<Information> patch(@PathVariable UUID id, @Valid @RequestBody StatusPatch body) {
        Information info = repo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
        info.setStatus(body.status());
        info.setUpdatedAt(Instant.now());
        return ApiResponse.ok(repo.save(info));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
