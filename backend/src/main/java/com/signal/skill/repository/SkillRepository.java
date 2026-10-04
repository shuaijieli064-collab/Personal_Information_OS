package com.signal.skill.repository;

import com.signal.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SkillRepository extends JpaRepository<Skill, UUID> {
    List<Skill> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);
    Optional<Skill> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);
}
