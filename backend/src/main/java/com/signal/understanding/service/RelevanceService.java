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

    /**
     * Result of a relevance pass. Decomposed so the Signal scorer can weigh
     * goal alignment and personal interest separately instead of reusing one number.
     */
    public record Relevance(double score, boolean goalMatched, int interestMatches, String why) {}

    private static final double BASE = 20;
    private static final double GOAL_BONUS = 35;
    private static final double INTEREST_BONUS = 15;

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

    /**
     * Pure computation against the user's goals/interests. Reads only — safe to call
     * outside a write transaction (e.g. between provider call and persist).
     */
    public Relevance compute(UUID userId, String title, String content) {
        List<String> goals = goalRepo.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(g -> g.getTitle()).toList();
        List<String> interests = interestRepo.findAllByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(i -> i.getName()).toList();

        String hay = ((title == null ? "" : title) + " "
                + (content == null ? "" : content)).toLowerCase();

        double score = BASE;
        boolean goalMatched = false;
        int interestMatches = 0;
        List<String> reasons = new ArrayList<>();
        for (String g : goals) {
            if (contains(hay, g)) {
                score += GOAL_BONUS;
                goalMatched = true;
                reasons.add("Matches your goal: " + g);
                break;
            }
        }
        for (String i : interests) {
            if (contains(hay, i)) {
                score += INTEREST_BONUS;
                interestMatches++;
                reasons.add("Matches your interest: " + i);
            }
        }
        score = Math.min(100, score);
        String why = reasons.isEmpty()
                ? "Not clearly matched to your current context."
                : String.join(" ", reasons);
        return new Relevance(score, goalMatched, interestMatches, why);
    }

    /** Persists the computed relevance onto the understanding row. */
    public void persist(UUID informationId, Relevance r) {
        InformationUnderstanding row = repo.findByInformationId(informationId)
                .orElseGet(() -> {
                    InformationUnderstanding nr = new InformationUnderstanding();
                    nr.setInformationId(informationId);
                    return nr;
                });
        row.setRelevanceScore(r.score());
        row.setWhyRelevant(r.why());
        row.setUpdatedAt(Instant.now());
        row.setStatus("COMPLETED");
        repo.save(row);
    }

    @Transactional
    public Information score(UUID userId, UUID informationId) {
        Information info = infoRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));

        Relevance r = compute(userId, info.getTitle(), info.getContent());
        persist(informationId, r);
        return info;
    }

    private boolean contains(String hay, String needle) {
        if (needle == null || needle.isBlank()) return false;
        return hay.contains(needle.toLowerCase().trim());
    }
}
