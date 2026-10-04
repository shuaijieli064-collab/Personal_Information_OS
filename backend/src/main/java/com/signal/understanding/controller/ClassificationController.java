package com.signal.understanding.controller;

import com.signal.common.ApiResponse;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.service.ClassificationService;
import com.signal.understanding.service.TopicExtractionService;
import com.signal.understanding.service.SummaryService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/information")
public class ClassificationController {

    private final ClassificationService service;
    private final TopicExtractionService topics;
    private final SummaryService summary;
    private final InformationRepository infoRepo;

    public ClassificationController(ClassificationService service, TopicExtractionService topics,
                                    SummaryService summary, InformationRepository infoRepo) {
        this.service = service;
        this.topics = topics;
        this.summary = summary;
        this.infoRepo = infoRepo;
    }

    @PostMapping("/{id}/summarize")
    public ApiResponse<Information> summarize(@PathVariable UUID id) {
        return ApiResponse.ok(summary.summarize(userId(), id));
    }

    @PostMapping("/{id}/extract-topics")
    public ApiResponse<Information> extractTopics(@PathVariable UUID id) {
        return ApiResponse.ok(topics.extract(userId(), id));
    }

    @PostMapping("/{id}/classify")
    public ApiResponse<Information> classify(@PathVariable UUID id) {
        return ApiResponse.ok(service.classify(userId(), id));
    }

    @PostMapping("/classify-batch")
    public ApiResponse<Integer> classifyBatch(@RequestBody List<UUID> ids) {
        return ApiResponse.ok(service.classifyBatch(userId(), ids));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
