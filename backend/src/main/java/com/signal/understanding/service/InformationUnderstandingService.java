package com.signal.understanding.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.provider.InformationUnderstandingProvider;
import com.signal.understanding.provider.UnderstandingResult;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.RelevanceService.Relevance;
import com.signal.signal.service.SignalGenerationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

/**
 * Orchestrates the pipeline described in ARCHITECTURE.md §1.3:
 *
 * <pre>
 *   understand (provider) → relevance (goals/interests) → signal score → Signal?
 * </pre>
 *
 * <p><b>Transaction boundaries matter.</b> The provider may be a blocking HTTP call
 * with a 20s timeout; holding a DB connection across it would starve the pool. So the
 * flow is deliberately split: two short write transactions with the provider call in
 * between, outside any transaction.
 */
@Service
public class InformationUnderstandingService {

    private static final Logger log = LoggerFactory.getLogger(InformationUnderstandingService.class);

    private final InformationRepository informationRepo;
    private final InformationUnderstandingRepository repo;
    private final InformationUnderstandingProvider provider;
    private final RelevanceService relevanceService;
    private final SignalGenerationService signalService;
    private final TransactionTemplate tx;

    public InformationUnderstandingService(InformationRepository informationRepo,
                                           InformationUnderstandingRepository repo,
                                           InformationUnderstandingProvider provider,
                                           RelevanceService relevanceService,
                                           SignalGenerationService signalService,
                                           PlatformTransactionManager txManager) {
        this.informationRepo = informationRepo;
        this.repo = repo;
        this.provider = provider;
        this.relevanceService = relevanceService;
        this.signalService = signalService;
        this.tx = new TransactionTemplate(txManager);
    }

    @Transactional(readOnly = true)
    public InformationUnderstanding get(UUID userId, UUID informationId) {
        requireOwned(userId, informationId); // IDOR
        return repo.findByInformationId(informationId).orElse(null);
    }

    /** Idempotent: runs the pipeline end to end and marks the row COMPLETED or FAILED. */
    public InformationUnderstanding process(UUID userId, UUID informationId) {
        // ── Phase 1 · write transaction: ownership check + claim the row ──────────
        Information info = tx.execute(status -> {
            Information i = requireOwned(userId, informationId);
            InformationUnderstanding row = loadOrCreate(informationId);
            row.setStatus("PROCESSING");
            row.setUpdatedAt(Instant.now());
            repo.save(row);
            return i;
        });

        // ── Phase 2 · NO transaction: provider call (may be HTTP) ─────────────────
        UnderstandingResult result;
        try {
            result = provider.understand(info.getTitle(), info.getContent());
        } catch (RuntimeException e) {
            tx.executeWithoutResult(status -> markFailed(informationId, e));
            throw e;
        }

        // ── Phase 3 · write transaction: persist + relevance + signal ─────────────
        return tx.execute(status -> finalizeUnderstanding(userId, informationId, info, result));
    }

    private InformationUnderstanding finalizeUnderstanding(UUID userId, UUID informationId,
                                                          Information info, UnderstandingResult result) {
        InformationUnderstanding row = loadOrCreate(informationId);
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
        repo.save(row);

        Relevance relevance = relevanceService.compute(userId, info.getTitle(), info.getContent());
        relevanceService.persist(informationId, relevance);

        // Below threshold this returns null — the score is still recorded for observability.
        signalService.generate(userId, informationId, relevance);
        return row;
    }

    private void markFailed(UUID informationId, Exception cause) {
        InformationUnderstanding row = loadOrCreate(informationId);
        row.setStatus("FAILED");
        row.setUpdatedAt(Instant.now());
        repo.save(row);
        log.warn("Understanding failed information={} err={}", informationId, cause.getMessage());
    }

    private InformationUnderstanding loadOrCreate(UUID informationId) {
        return repo.findByInformationId(informationId).orElseGet(() -> {
            InformationUnderstanding r = new InformationUnderstanding();
            r.setInformationId(informationId);
            return r;
        });
    }

    private Information requireOwned(UUID userId, UUID informationId) {
        return informationRepo.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));
    }
}
