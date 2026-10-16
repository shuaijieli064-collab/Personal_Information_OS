package com.signal.signal.repository;

import com.signal.signal.entity.Signal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SignalRepository extends JpaRepository<Signal, UUID> {
    /**
     * Feed ordering: score first, then recency for ties. Callers deliberately pass a
     * createdAt Sort as well — Spring Data appends it rather than replacing the
     * method's own ORDER BY, yielding {@code signal_score DESC, created_at DESC}.
     * Verified against Postgres; dropping one half silently changes feed order.
     */
    Page<Signal> findByUserIdOrderBySignalScoreDesc(UUID userId, Pageable pageable);
    Optional<Signal> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByInformationId(UUID informationId);

    /** Used by the notification dedupe sweep: the user's signals in a given status. */
    List<Signal> findByUserIdAndStatus(UUID userId, String status);
}
