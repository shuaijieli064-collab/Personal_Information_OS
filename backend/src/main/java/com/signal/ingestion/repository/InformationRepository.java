package com.signal.ingestion.repository;

import com.signal.ingestion.entity.Information;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InformationRepository extends JpaRepository<Information, UUID> {
    Optional<Information> findBySourceItemId(UUID sourceItemId);
    Optional<Information> findByIdAndUserId(UUID id, UUID userId);
    Page<Information> findByUserId(UUID userId, Pageable pageable);
    /** Inbox filtering: one triage state at a time (ACTIVE / KEPT / ARCHIVED). */
    Page<Information> findByUserIdAndStatus(UUID userId, String status, Pageable pageable);
    /** Inbox "needs review" is two states at once: ACTIVE and KEPT. */
    Page<Information> findByUserIdAndStatusIn(UUID userId, java.util.Collection<String> statuses,
                                              Pageable pageable);
    List<Information> findByUserId(UUID userId);
    long countByUserId(UUID userId);
    /** Source-detail drawer: the items one source contributed, paged like the inbox. */
    Page<Information> findByUserIdAndSourceId(UUID userId, UUID sourceId, Pageable pageable);
    /** Same, combined with one triage state (ACTIVE / KEPT / ARCHIVED). */
    Page<Information> findByUserIdAndSourceIdAndStatus(UUID userId, UUID sourceId, String status,
                                                       Pageable pageable);
    /** Same, combined with a state set (the comma-separated review query). */
    Page<Information> findByUserIdAndSourceIdAndStatusIn(UUID userId, UUID sourceId,
                                                         java.util.Collection<String> statuses,
                                                         Pageable pageable);
}
