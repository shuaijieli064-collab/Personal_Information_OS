package com.signal.dedup;

import com.signal.ai.EmbeddingProvider;
import com.signal.ingestion.entity.Information;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Same-event detection — stops the product telling the user the same thing twice.
 *
 * <p>Exact duplicates (same URL, same content hash) are already dropped at ingestion. This
 * covers the case that one cannot: the same story republished under two URLs, or covered by
 * two sources. The item still exists (two sources agreeing is corroboration, not noise), but
 * it does not become a second Signal.
 *
 * <p>Only signal-worthy items are embedded, so the cost is one embedding call per signal
 * rather than one per ingested item.
 *
 * <p>Degradation: if the embedding provider fails, the guard returns "not a duplicate" and
 * the item becomes a Signal normally. A dedup miss is a small cost; a failed analysis is not.
 */
@Service
public class DuplicateSignalGuard {

    private static final Logger log = LoggerFactory.getLogger(DuplicateSignalGuard.class);

    /** Title carries the event; the body disambiguates items that share a headline shape. */
    private static final int BODY_CHARS = 500;

    private final EmbeddingProvider embeddings;
    private final InformationEmbeddingStore store;
    private final double threshold;

    public DuplicateSignalGuard(EmbeddingProvider embeddings,
                                InformationEmbeddingStore store,
                                @Value("${app.dedup.similarity-threshold:0.85}") double threshold) {
        this.embeddings = embeddings;
        this.store = store;
        this.threshold = threshold;
    }

    /**
     * Records this item's embedding and returns the item that already covers the same event,
     * when there is one above the similarity threshold.
     */
    public Optional<InformationEmbeddingStore.Match> duplicateOf(UUID userId, Information info) {
        List<Double> vector;
        try {
            vector = embeddings.embed(embedText(info));
        } catch (Exception e) {
            log.warn("Dedup skipped — embedding failed information={} err={}", info.getId(), e.toString());
            return Optional.empty();
        }
        if (vector == null || vector.isEmpty()) return Optional.empty();

        try {
            store.save(info.getId(), vector, embeddings.model());
            return store.nearestOther(userId, info.getId(), vector)
                    .filter(m -> m.similarity() >= threshold);
        } catch (Exception e) {
            // A dedup miss must never fail the pipeline that called us.
            log.warn("Dedup lookup failed information={} err={}", info.getId(), e.toString());
            return Optional.empty();
        }
    }

    /** Links a suppressed duplicate to the cluster its anchor owns, so corroboration is a fact. */
    public void corroborate(UUID userId, InformationEmbeddingStore.Match anchor, Information duplicate) {
        try {
            UUID clusterId = store.clusterFor(userId, anchor.informationId(), anchor.title(),
                    anchor.similarity());
            store.link(clusterId, duplicate.getId(), anchor.similarity());
        } catch (Exception e) {
            log.warn("Could not record corroboration information={} anchor={} err={}",
                    duplicate.getId(), anchor.informationId(), e.toString());
        }
    }

    private String embedText(Information info) {
        String title = info.getTitle() == null ? "" : info.getTitle();
        String body = info.getExcerpt();
        if (body == null || body.isBlank()) body = info.getContent();
        if (body == null) body = "";
        if (body.length() > BODY_CHARS) body = body.substring(0, BODY_CHARS);
        return title + "\n" + body;
    }
}
