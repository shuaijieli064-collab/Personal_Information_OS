package com.signal.ingestion.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.pipeline.NormalizedItem;
import com.signal.ingestion.pipeline.SourceCollector;
import com.signal.ingestion.repository.SourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Unified ingestion orchestrator.
 * Collector (network) runs OUTSIDE any DB transaction; writes go through IngestionPersister.
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    public record SyncResult(UUID sourceId, int fetched, int created, int updated, int duplicates, int failed) {}

    private final List<SourceCollector> collectors;
    private final SourceRepository sources;
    private final IngestionPersister persister;

    public IngestionService(List<SourceCollector> collectors, SourceRepository sources,
                            IngestionPersister persister) {
        this.collectors = collectors;
        this.sources = sources;
        this.persister = persister;
    }

    public SyncResult sync(UUID userId, UUID sourceId) {
        Source source = sources.findByIdAndUserId(sourceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Source not found"));
        SourceCollector collector = collectors.stream()
                .filter(c -> c.supports(source.getType())).findFirst()
                .orElseThrow(() -> new IllegalStateException("No collector for " + source.getType()));

        List<NormalizedItem> normalized;
        try {
            normalized = collector.collect(source); // NETWORK outside transaction
        } catch (Exception e) {
            log.warn("Source sync failed source={} type={} err={}", sourceId, source.getType(), e.toString());
            markSource(source, "ERROR");
            throw new SourceSyncException("Unable to synchronize source.");
        }
        IngestionService.SyncResult r = persister.persist(source, normalized);
        markSource(source, "ACTIVE");
        log.info("Source synced id={} fetched={} created={} duplicates={}",
                sourceId, r.fetched(), r.created(), r.duplicates());
        return r;
    }

    /** Already-normalized one-off import (URL import / file upload). */
    public void persistDirect(Source source, NormalizedItem item) {
        persister.persist(source, List.of(item));
        markSource(source, "ACTIVE");
    }

    private void markSource(Source source, String status) {
        source.setStatus(status);
        source.setLastSyncedAt(Instant.now());
        sources.save(source);
    }

    public static class SourceSyncException extends RuntimeException {
        public SourceSyncException(String m) { super(m); }
    }
}
