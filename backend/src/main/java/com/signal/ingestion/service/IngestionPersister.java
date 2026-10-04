package com.signal.ingestion.service;

import com.signal.ingestion.entity.Information;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.entity.SourceItem;
import com.signal.ingestion.pipeline.Hashing;
import com.signal.ingestion.pipeline.NormalizedItem;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.ingestion.repository.SourceItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Transactional DB writes only — no network here. */
@Service
public class IngestionPersister {

    private static final Logger log = LoggerFactory.getLogger(IngestionPersister.class);

    private final SourceItemRepository items;
    private final InformationRepository info;

    public IngestionPersister(SourceItemRepository items, InformationRepository info) {
        this.items = items;
        this.info = info;
    }

    @Transactional
    public IngestionService.SyncResult persist(Source source, List<NormalizedItem> list) {
        int created = 0, updated = 0, duplicates = 0, failed = 0;
        for (NormalizedItem it : list) {
            try {
                String key = it.externalId() != null && !it.externalId().isBlank()
                        ? it.externalId() : Hashing.canonicalUrl(it.url());
                String urlHash = Hashing.sha256(key);
                String contentHash = Hashing.sha256(it.title() + "\n"
                        + (it.content() == null ? "" : it.content()) + "\n" + Hashing.canonicalUrl(it.url()));

                SourceItem row = items.findBySourceIdAndUrlHash(source.getId(), urlHash).orElse(null);
                boolean isNew = (row == null);
                if (isNew) {
                    row = new SourceItem();
                    row.setSourceId(source.getId());
                    row.setExternalId(it.externalId());
                    row.setUrl(it.url());
                    row.setUrlHash(urlHash);
                }
                row.setTitle(it.title() == null || it.title().isBlank() ? "Untitled" : it.title());
                row.setAuthor(it.author());
                row.setContentText(it.content());
                row.setContentHash(contentHash);
                row.setLang(it.language());
                row.setPublishedAt(it.publishedAt());
                row = items.save(row);

                Information infoRow = info.findBySourceItemId(row.getId()).orElse(null);
                if (infoRow == null) {
                    infoRow = new Information();
                    infoRow.setUserId(source.getUserId());
                    infoRow.setSourceId(source.getId());
                    infoRow.setSourceItemId(row.getId());
                    created++;
                } else {
                    duplicates++;
                }
                infoRow.setType(it.type() == null ? "ARTICLE" : it.type());
                infoRow.setTitle(row.getTitle());
                infoRow.setContent(it.content());
                infoRow.setExcerpt(it.excerpt());
                infoRow.setUrl(it.url());
                infoRow.setAuthor(it.author());
                infoRow.setPublishedAt(it.publishedAt());
                infoRow.setContentHash(contentHash);
                infoRow.setLanguage(it.language());
                infoRow.setUpdatedAt(Instant.now());
                info.save(infoRow);
                if (!isNew) updated++;
            } catch (Exception e) {
                failed++;
                log.warn("Item persist failed source={} err={}", source.getId(), e.toString());
            }
        }
        return new IngestionService.SyncResult(source.getId(), list.size(), created, updated, duplicates, failed);
    }
}
