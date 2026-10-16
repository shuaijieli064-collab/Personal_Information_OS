package com.signal.task.repository;

import com.signal.task.entity.JobRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface JobRunRepository extends JpaRepository<JobRun, UUID> {

    Page<JobRun> findByJobIdOrderByCreatedAtDesc(UUID jobId, Pageable pageable);

    Optional<JobRun> findByIdAndUserId(UUID id, UUID userId);
}
