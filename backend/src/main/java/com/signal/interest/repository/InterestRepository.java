package com.signal.interest.repository;

import com.signal.interest.entity.Interest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InterestRepository extends JpaRepository<Interest, UUID> {
    List<Interest> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);
    Optional<Interest> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByUserIdAndNormalizedName(UUID userId, String normalizedName);
}
