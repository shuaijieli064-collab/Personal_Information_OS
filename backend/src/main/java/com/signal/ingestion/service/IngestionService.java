package com.signal.ingestion.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.pipeline.CollectFailure;
import com.signal.ingestion.pipeline.NormalizedItem;
import com.signal.ingestion.pipeline.SourceCollector;
import com.signal.ingestion.repository.SourceRepository;
import com.signal.understanding.service.InformationUnderstandingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

    public record SyncResult(UUID sourceId, int fetched, int created, int updated,
                             int duplicates, int failed, List<UUID> createdIds,
                             /** Non-null when the collector resolved the source's URL to a
                              *  better one (a homepage to its feed). */
                             String resolvedUrl) {}

    private final List<SourceCollector> collectors;
    private final SourceRepository sources;
    private final IngestionPersister persister;
    private final InformationUnderstandingService understanding;
    private final com.signal.knowledge.ChunkService chunks;
    private final int autoUnderstandLimit;
    private final int autoChunkLimit;

    public IngestionService(List<SourceCollector> collectors, SourceRepository sources,
                            IngestionPersister persister, InformationUnderstandingService understanding,
                            com.signal.knowledge.ChunkService chunks,
                            @Value("${app.pipeline.auto-understand-limit:20}") int autoUnderstandLimit,
                            @Value("${app.pipeline.auto-chunk-limit:20}") int autoChunkLimit) {
        this.collectors = collectors;
        this.sources = sources;
        this.persister = persister;
        this.understanding = understanding;
        this.chunks = chunks;
        this.autoUnderstandLimit = autoUnderstandLimit;
        this.autoChunkLimit = autoChunkLimit;
    }

    public SyncResult sync(UUID userId, UUID sourceId) {
        Source source = sources.findByIdAndUserId(sourceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Source not found"));
        SourceCollector collector = collectors.stream()
                .filter(c -> c.supports(source.getType())).findFirst()
                .orElseThrow(() -> new IllegalStateException("No collector for " + source.getType()));

        SourceCollector.CollectResult collected;
        try {
            collected = collector.collect(source); // NETWORK outside transaction
        } catch (Exception e) {
            CollectFailure failure = CollectFailure.of(e);
            log.warn("Source sync failed source={} type={} reason={} err={}",
                    sourceId, source.getType(), failure.reason(), failure.getMessage());
            markSource(source, "ERROR");
            throw new SourceSyncException(failure.reason().name(), failure.getMessage());
        }
        List<NormalizedItem> normalized = collected.items();
        adoptResolvedUrl(source, collected);
        IngestionService.SyncResult r = persister.persist(source, normalized);
        markSource(source, "ACTIVE");
        understandNew(userId, r.createdIds());
        chunkNew(userId, r.createdIds());
        log.info("Source synced id={} fetched={} created={} duplicates={} resolved={}",
                sourceId, r.fetched(), r.created(), r.duplicates(), collected.resolvedUrl());
        return new SyncResult(r.sourceId(), r.fetched(), r.created(), r.updated(),
                r.duplicates(), r.failed(), r.createdIds(), collected.resolvedUrl());
    }

    /**
     * A homepage whose feed lives elsewhere is rewritten to point at the feed, and an
     * RSS-typed source that turned out to be a page becomes the type that matches.
     * Without this every sync repeats the discovery and the source keeps its wrong
     * type in the UI.
     */
    private void adoptResolvedUrl(Source source, SourceCollector.CollectResult collected) {
        if (collected.resolvedUrl() == null || collected.resolvedUrl().isBlank()) return;
        if (collected.resolvedUrl().equals(source.getUrl())) return;
        source.setUrl(collected.resolvedUrl());
        if (collected.resolvedType() != null && !collected.resolvedType().isBlank()) {
            source.setType(collected.resolvedType());
        }
        sources.save(source);
        log.info("Source URL resolved id={} -> {} ({})",
                source.getId(), collected.resolvedUrl(), source.getType());
    }

    /** Already-normalized one-off import (URL import / file upload). */
    public void persistDirect(Source source, NormalizedItem item) {
        IngestionService.SyncResult r = persister.persist(source, List.of(item));
        markSource(source, "ACTIVE");
        understandNew(source.getUserId(), r.createdIds());
        chunkNew(source.getUserId(), r.createdIds());
    }

    /**
     * Drives understanding -> relevance -> signal for items created by this write.
     * Each item is isolated: one provider failure must not abort the batch or the sync.
     */
    private void understandNew(UUID userId, List<UUID> createdIds) {
        if (createdIds.isEmpty()) return;
        int ok = 0;
        int limit = Math.min(createdIds.size(), autoUnderstandLimit);
        for (int i = 0; i < limit; i++) {
            UUID infoId = createdIds.get(i);
            try {
                understanding.process(userId, infoId);
                ok++;
            } catch (Exception e) {
                log.warn("Auto-understanding failed information={} err={}", infoId, e.toString());
            }
        }
        if (limit < createdIds.size()) {
            log.info("Auto-understanding capped at {} of {} new items", limit, createdIds.size());
        }
        log.info("Auto-understanding done total={} ok={} failed={}", limit, ok, limit - ok);
    }

    /**
     * Phase 6 K2: chunk + embed freshly created rows; a chunking failure must not abort the sync.
     *
     * <p>Capped exactly like auto-understanding: every chunk costs one embedding call —
     * with a real provider that is an HTTP round-trip, and all of them run on the request
     * thread. A first sync of a long-lived feed (or a bulk import) would otherwise hold
     * the request for hundreds of sequential calls. The remainder is not lost: it is
     * covered by {@code POST /api/v1/knowledge/reindex} (idempotent, also how a model
     * change is rolled out), the same escape hatch understanding already relies on.
     */
    private void chunkNew(UUID userId, List<UUID> createdIds) {
        if (createdIds.isEmpty()) return;
        int limit = Math.min(createdIds.size(), autoChunkLimit);
        if (limit < createdIds.size()) {
            log.info("Auto-chunking capped at {} of {} new items (reindex covers the rest)",
                    limit, createdIds.size());
        }
        if (limit <= 0) return;
        int ok = chunks.chunkIds(userId, createdIds.subList(0, limit));
        log.info("Auto-chunking done total={} ok={}", limit, ok);
    }

    private void markSource(Source source, String status) {
        source.setStatus(status);
        source.setLastSyncedAt(Instant.now());
        sources.save(source);
    }

    /**
     * A sync the user can act on. {@code reason} is one of
     * {@link CollectFailure.Reason} and is what the UI shows; {@code detail} is the
     * raw cause, logged and returned for the developer console.
     */
    public static class SourceSyncException extends RuntimeException {
        private final String reason;

        public SourceSyncException(String reason, String detail) {
            super(detail);
            this.reason = reason;
        }

        public String reason() { return reason; }
    }
}
