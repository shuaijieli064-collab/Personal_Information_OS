package com.signal.signal.repository;

import com.signal.signal.entity.UserFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, UUID> {
    Optional<UserFeedback> findByUserIdAndSignalId(UUID userId, UUID signalId);
}
