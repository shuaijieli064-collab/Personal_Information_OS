package com.signal.ingestion.repository;

import com.signal.ingestion.entity.Source;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SourceRepository extends JpaRepository<Source, UUID> {
    List<Source> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Source> findByIdAndUserId(UUID id, UUID userId);
}
