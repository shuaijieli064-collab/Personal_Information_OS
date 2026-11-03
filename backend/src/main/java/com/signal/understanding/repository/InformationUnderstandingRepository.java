package com.signal.understanding.repository;

import com.signal.understanding.entity.InformationUnderstanding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InformationUnderstandingRepository extends JpaRepository<InformationUnderstanding, UUID> {
    Optional<InformationUnderstanding> findByInformationId(UUID informationId);

    /** Batch lookup so a page of inbox rows can carry their scores in one query. */
    List<InformationUnderstanding> findByInformationIdIn(java.util.Collection<UUID> ids);
}
