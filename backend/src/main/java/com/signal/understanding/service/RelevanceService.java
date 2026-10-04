package com.signal.understanding.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.goal.repository.GoalRepository;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.interest.repository.InterestRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class RelevanceService {

    private final InformationRepository infoRepo;
    private final InformationUnderstandingRepository repo;
    private final GoalRepository goalRepo;
    private final InterestRepository interestRepo;

    public RelevanceService(InformationRepository infoRepo,
                            InformationUnderstandingRepository repo,
                            GoalRepository goalRepo, InterestRepository interestRepo) {
        this.infoRepo = infoRepo; this.repo = repo;
        this.goalRepo = goalRepo; this.interestRepo = interestRepo;
    }

    @Transactional
    public Information score(UUID userId, UUID informationId) {
        Information info = infoRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));

        List<String> goals = goalRepo.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(g -> g.getTitle()).toList();
        List<String> interests = interestRepo.findAllByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(i -> i.getName()).toList();

        String hay = ((info.getTitle() == null ? "" : info.getTitle()) + " "
                + (info.getContent() == null ? "" : info.getContent())).toLowerCase();

        double score = 20;
        List<String> reasons = new ArrayList<>();
        for (String g : goals) {
            if (contains(hay, g)) { score += 35; reasons.add("Matches your goal: " + g); break; }
        }
        for (String i : interests) {
            if (contains(hay, i)) { score += 15; reasons.add("Matches your interest: " + i); }
        }
        score = Math.min(100, score);

        InformationUnderstanding row = repo.findByInformationId(informationId)
                .orElseGet(() -> {
                    InformationUnderstanding r = new InformationUnderstanding();
                    r.setInformationId(informationId);
                    return r;
                });
        row.setRelevanceScore(score);
        row.setWhyRelevant(reasons.isEmpty() ? "Not clearly matched to your current context."
                : String.join(" ", reasons));
        row.setUpdatedAt(Instant.now());
        row.setStatus("COMPLETED");
        repo.save(row);
        return info;
    }

    private boolean contains(String hay, String needle) {
        if (needle == null || needle.isBlank()) return false;
        return hay.contains(needle.toLowerCase().trim());
    }
}
