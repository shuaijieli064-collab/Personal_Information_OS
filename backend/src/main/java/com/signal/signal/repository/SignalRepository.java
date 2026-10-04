package com.signal.signal.repository;

import com.signal.signal.entity.Signal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SignalRepository extends JpaRepository<Signal, UUID> {
    Page<Signal> findByUserIdOrderBySignalScoreDesc(UUID userId, Pageable pageable);
    Optional<Signal> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByInformationId(UUID informationId);
}
