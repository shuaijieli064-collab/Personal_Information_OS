package com.signal.ai.agent;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AgentRunRepository extends JpaRepository<AgentRun, UUID> {

    Optional<AgentRun> findByIdAndUserId(UUID id, UUID userId);

    Page<AgentRun> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
