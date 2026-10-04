package com.signal.signal.controller;

import com.signal.common.ApiResponse;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.signal.entity.Signal;
import com.signal.signal.entity.UserFeedback;
import com.signal.signal.repository.SignalRepository;
import com.signal.signal.repository.UserFeedbackRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/signals/{id}/feedback")
public class FeedbackController {

    private static final Set<String> TYPES =
            Set.of("USEFUL","NOT_USEFUL","SAVE","IGNORE","IMPORTANT");

    private final SignalRepository signalRepo;
    private final UserFeedbackRepository feedbackRepo;

    public FeedbackController(SignalRepository signalRepo, UserFeedbackRepository feedbackRepo) {
        this.signalRepo = signalRepo; this.feedbackRepo = feedbackRepo;
    }

    @PostMapping
    public ApiResponse<UserFeedback> post(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        Signal s = signalRepo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Signal not found"));
        String type = body.getOrDefault("type", "").toUpperCase();
        if (!TYPES.contains(type)) throw new IllegalArgumentException("Invalid feedback type");

        UserFeedback f = feedbackRepo.findByUserIdAndSignalId(userId(), id)
                .orElseGet(UserFeedback::new);
        if (f.getId() == null) { f.setUserId(userId()); f.setSignalId(id); }
        f.setType(type);
        f.setReason(body.get("reason"));
        f.setUpdatedAt(Instant.now());
        return ApiResponse.ok(feedbackRepo.save(f));
    }

    @GetMapping
    public ApiResponse<UserFeedback> get(@PathVariable UUID id) {
        signalRepo.findByIdAndUserId(id, userId())
                .orElseThrow(() -> new ResourceNotFoundException("Signal not found"));
        return ApiResponse.ok(feedbackRepo.findByUserIdAndSignalId(userId(), id).orElse(null));
    }

    private UUID userId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
