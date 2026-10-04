package com.signal.ingestion.repository;

import com.signal.ingestion.entity.SourceItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SourceItemRepository extends JpaRepository<SourceItem, UUID> {
    Optional<SourceItem> findBySourceIdAndUrlHash(UUID sourceId, String urlHash);
}
