package com.signal.ingestion.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.dto.SourceRequest;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.repository.SourceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SourceService {

    private final SourceRepository repo;

    public SourceService(SourceRepository repo) { this.repo = repo; }

    @Transactional(readOnly = true)
    public List<Source> list(UUID userId) { return repo.findAllByUserIdOrderByCreatedAtDesc(userId); }

    @Transactional(readOnly = true)
    public Source get(UUID userId, UUID id) {
        return repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Source not found"));
    }

    @Transactional
    public Source create(UUID userId, SourceRequest req) {
        Source s = new Source();
        s.setUserId(userId);
        s.setName(req.name().trim());
        s.setType(req.type().toUpperCase());
        s.setUrl(req.url() == null ? null : req.url().trim());
        s.setStatus("ACTIVE");
        return repo.save(s);
    }

    @Transactional
    public Source update(UUID userId, UUID id, SourceRequest req) {
        Source s = get(userId, id);
        if (req.name() != null) s.setName(req.name().trim());
        if (req.url() != null) s.setUrl(req.url().trim());
        s.setUpdatedAt(Instant.now());
        return repo.save(s);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Source s = get(userId, id); // IDOR guard: not owned → 404
        repo.delete(s); // FK ON DELETE CASCADE removes items + information
    }
}
