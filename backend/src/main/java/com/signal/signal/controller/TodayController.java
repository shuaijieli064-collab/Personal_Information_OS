package com.signal.signal.controller;

import com.signal.common.ApiResponse;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/today")
public class TodayController {

    private final InformationRepository infoRepo;
    private final SignalRepository signalRepo;

    public TodayController(InformationRepository infoRepo, SignalRepository signalRepo) {
        this.infoRepo = infoRepo; this.signalRepo = signalRepo;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> today() {
        var u = userId();
        long information = infoRepo.findByUserId(u, PageRequest.of(0, 1)).getTotalElements();
        var signals = signalRepo.findByUserIdOrderBySignalScoreDesc(u, PageRequest.of(0, 100));
        long action = signals.getContent().stream().filter(s -> "IMPORTANT".equals(s.getStatus())).count();
        return ApiResponse.ok(Map.of(
                "informationCount", information,
                "signalCount", signals.getTotalElements(),
                "actionRequired", action,
                "signals", signals.getContent()));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
