package com.signal.brief.repository;

import com.signal.brief.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Optional<Notification> findFirstByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, String type);

    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);

    long countByUserIdAndReadFalse(UUID userId);

    List<Notification> findByUserIdAndReadFalse(UUID userId);

    /**
     * Dedupe guard for IMPORTANT_SIGNAL: the signal id is embedded verbatim in
     * {@code payload}, so an exact match means this signal was already announced.
     */
    boolean existsByUserIdAndTypeAndPayload(UUID userId, String type, String payload);
}
