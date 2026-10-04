package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;

import java.util.List;

/** One collector per source type. Collect → Normalize only; never touches JPA directly. */
public interface SourceCollector {
    boolean supports(String sourceType);
    List<NormalizedItem> collect(Source source) throws Exception;
}
