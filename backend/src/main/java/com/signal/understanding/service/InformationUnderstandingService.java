package com.signal.understanding.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.provider.InformationUnderstandingProvider;
import com.signal.understanding.provider.UnderstandingResult;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class InformationUnderstandingService {

    private final InformationRepository informationRepo;
    private final InformationUnderstandingRepository repo;
    private final InformationUnderstandingProvider provider;

    public InformationUnderstandingService(InformationRepository informationRepo,
                                           InformationUnderstandingRepository repo,
                                           InformationUnderstandingProvider provider) {
        this.informationRepo = informationRepo;
        this.repo = repo;
        this.provider = provider;
    }

    @Transactional(readOnly = true)
    public InformationUnderstanding get(UUID userId, UUID informationId) {
        requireOwned(userId, informationId); // IDOR
        return repo.findByInformationId(informationId).orElse(null);
    }

    /** Idempotent: creates PENDING row if absent, runs provider, marks COMPLETED. */
    @Transactional
    public InformationUnderstanding process(UUID userId, UUID informationId) {
        Information info = requireOwned(userId, informationId);

        InformationUnderstanding row = repo.findByInformationId(informationId)
                .orElseGet(() -> {
                    InformationUnderstanding r = new InformationUnderstanding();
                    r.setInformationId(informationId);
                    return r;
                });
        row.setStatus("PROCESSING");
        row.setUpdatedAt(Instant.now());

        UnderstandingResult result = provider.understand(info.getTitle(), info.getContent());
        row.setLanguage(result.language());
        row.setContentType(result.contentType());
        row.setClassification(result.classification());
        row.setTopics(result.topicsJson());
        row.setEntities(result.entitiesJson());
        row.setSummary(result.summary());
        row.setModel(result.model());
        row.setModelVersion(result.modelVersion());
        row.setStatus("COMPLETED");
        row.setProcessedAt(Instant.now());
        row.setUpdatedAt(Instant.now());
        return repo.save(row);
    }

    private Information requireOwned(UUID userId, UUID informationId) {
        return informationRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
    }
}
