package com.signal.ingestion.repository;

import com.signal.ingestion.entity.Information;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InformationRepository extends JpaRepository<Information, UUID> {
    Optional<Information> findBySourceItemId(UUID sourceItemId);
    Optional<Information> findByIdAndUserId(UUID id, UUID userId);
    Page<Information> findByUserId(UUID userId, Pageable pageable);
    long countByUserId(UUID userId);
}
