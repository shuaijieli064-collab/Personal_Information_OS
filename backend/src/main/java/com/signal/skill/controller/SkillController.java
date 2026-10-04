package com.signal.skill.controller;

import com.signal.common.ApiResponse;
import com.signal.skill.dto.SkillRequest;
import com.signal.skill.entity.Skill;
import com.signal.skill.service.SkillService;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/skills")
public class SkillController {

    private final SkillService service;

    public SkillController(SkillService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<Skill>> list() { return ApiResponse.ok(service.list(userId())); }

    @PostMapping
    public ApiResponse<Skill> create(@Valid @RequestBody SkillRequest req) {
        return ApiResponse.ok(service.create(userId(), req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Skill> update(@PathVariable UUID id, @Valid @RequestBody SkillRequest req) {
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
