package com.signal.understanding.repository;

import com.signal.understanding.entity.InformationUnderstanding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InformationUnderstandingRepository extends JpaRepository<InformationUnderstanding, UUID> {
    Optional<InformationUnderstanding> findByInformationId(UUID informationId);
}
