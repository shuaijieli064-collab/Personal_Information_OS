package com.signal.goal.repository;

import com.signal.goal.entity.Goal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GoalRepository extends JpaRepository<Goal, UUID> {
    List<Goal> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Goal> findByIdAndUserId(UUID id, UUID userId);
}
