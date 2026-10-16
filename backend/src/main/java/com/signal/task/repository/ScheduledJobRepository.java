package com.signal.task.repository;

import com.signal.task.entity.ScheduledJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScheduledJobRepository extends JpaRepository<ScheduledJob, UUID> {

    /** The scheduler tick's query: everything that is on and due. */
    List<ScheduledJob> findByEnabledTrueAndNextRunAtLessThanEqual(Instant now);

    List<ScheduledJob> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<ScheduledJob> findByIdAndUserId(UUID id, UUID userId);

    Optional<ScheduledJob> findByUserIdAndType(UUID userId, String type);
}
