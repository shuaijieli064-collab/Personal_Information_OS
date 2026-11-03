package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;

import java.util.List;

/** One collector per source type. Collect → Normalize only; never touches JPA directly. */
public interface SourceCollector {
    boolean supports(String sourceType);

    /**
     * Collect from the source's URL. A collector may resolve the URL to something
     * better while doing so — a homepage whose real feed lives at /feed.xml — and
     * reports it here so the caller can persist it. Without that, every later sync
     * pays the discovery cost again and the source keeps its misleading type.
     */
    CollectResult collect(Source source) throws Exception;

    record CollectResult(List<NormalizedItem> items, String resolvedUrl, String resolvedType) {
        public static CollectResult of(List<NormalizedItem> items) {
            return new CollectResult(items, null, null);
        }

        public static CollectResult resolved(List<NormalizedItem> items, String url, String type) {
            return new CollectResult(items, url, type);
        }
    }
}
