package com.signal.task;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.repository.SourceRepository;
import com.signal.ingestion.service.IngestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Synchronises every enabled source the user owns, through the exact same service path
 * as {@code POST /sources/{id}/sync} ({@link IngestionService#sync}) so a scheduled sync
 * and a manual one can never diverge.
 *
 * <p>One source failing must not stop the others — a dead feed is normal — so each is
 * isolated and the returned detail reports the partial success honestly
 * ({@code "3 of 4 sources synced"}).
 */
@Component
public class SourceSyncJob {

    private static final Logger log = LoggerFactory.getLogger(SourceSyncJob.class);

    private final SourceRepository sources;
    private final IngestionService ingestion;

    public SourceSyncJob(SourceRepository sources, IngestionService ingestion) {
        this.sources = sources;
        this.ingestion = ingestion;
    }

    /** Runs the sync for every enabled source; never throws. */
    public String run(UUID userId) {
        List<Source> enabled = sources.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getActive()))
                .toList();
        if (enabled.isEmpty()) return "No enabled sources to sync";

        int ok = 0;
        for (Source source : enabled) {
            try {
                ingestion.sync(userId, source.getId());
                ok++;
            } catch (Exception e) {
                log.warn("Scheduled source sync failed source={} err={}", source.getId(), e.toString());
            }
        }
        return ok + " of " + enabled.size() + " sources synced";
    }
}
