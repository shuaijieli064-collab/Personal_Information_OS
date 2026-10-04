package com.signal.signal.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.SignalScoreCalculator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class SignalGenerationService {

    private final InformationRepository infoRepo;
    private final InformationUnderstandingRepository undRepo;
    private final SignalRepository signalRepo;
    private final double minScore;

    public SignalGenerationService(InformationRepository infoRepo,
                                   InformationUnderstandingRepository undRepo,
                                   SignalRepository signalRepo,
                                   @Value("${app.signal.min-score:70}") double minScore) {
        this.infoRepo = infoRepo; this.undRepo = undRepo;
        this.signalRepo = signalRepo; this.minScore = minScore;
    }

    @Transactional
    public Signal generate(UUID userId, UUID informationId) {
        Information info = infoRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
        if (signalRepo.existsByInformationId(informationId))
            throw new IllegalStateException("Signal already exists for this information");

        InformationUnderstanding und = undRepo.findByInformationId(informationId).orElse(null);

        double relevance = und != null && und.getRelevanceScore() != null ? und.getRelevanceScore() : 50;
        var result = SignalScoreCalculator.score(new SignalScoreCalculator.Factors(
                relevance, relevance, 60, 50, 50, relevance, 70));

        if (result.score() < minScore) return null; // below threshold — not a Signal

        Signal s = new Signal();
        s.setUserId(userId);
        s.setInformationId(informationId);
        s.setTitle(info.getTitle());
        s.setSummary(und != null ? und.getSummary() : info.getExcerpt());
        s.setSignalScore(result.score());
        s.setWhyItMatters(und != null ? und.getWhyRelevant() : "Matches your incoming information.");
        s.setUpdatedAt(Instant.now());
        return signalRepo.save(s);
    }
}
