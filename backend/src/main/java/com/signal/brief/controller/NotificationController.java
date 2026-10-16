package com.signal.brief.controller;

import com.signal.brief.NotificationService;
import com.signal.brief.dto.NotificationDto;
import com.signal.brief.dto.NotificationPage;
import com.signal.common.ApiResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Phase 8 notification inbox API. All routes are user-scoped by the caller's principal. */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    /** Page of the inbox, newest first, with the unread badge. */
    @GetMapping
    public ApiResponse<NotificationPage> list(@RequestParam(defaultValue = "false") boolean unread,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(service.list(userId(), unread, page, size));
    }

    /** Marks one notification read. Another user's id → 404. */
    @PostMapping("/{id}/read")
    public ApiResponse<NotificationDto> read(@PathVariable UUID id) {
        return ApiResponse.ok(service.markRead(userId(), id));
    }

    /** Marks every unread notification read. */
    @PostMapping("/read-all")
    public ApiResponse<Map<String, Object>> readAll() {
        return ApiResponse.ok(Map.of("updated", service.markAllRead(userId())));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
