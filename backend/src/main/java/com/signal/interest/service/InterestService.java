package com.signal.interest.service;

import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.interest.dto.InterestRequest;
import com.signal.interest.entity.Interest;
import com.signal.interest.repository.InterestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class InterestService {

    private final InterestRepository repo;

    public InterestService(InterestRepository repo) { this.repo = repo; }

    static String normalize(String s) { return s.trim().toLowerCase(); }

    @Transactional(readOnly = true)
    public List<Interest> list(UUID userId) { return repo.findAllByUserIdOrderByUpdatedAtDesc(userId); }

    @Transactional
    public Interest create(UUID userId, InterestRequest req) {
        String norm = normalize(req.name());
        if (repo.existsByUserIdAndNormalizedName(userId, norm)) {
            throw new DuplicateResourceException("Interest already exists");
        }
        Interest i = new Interest();
        i.setUserId(userId);
        i.setName(req.name().trim());
        i.setNormalizedName(norm);
        if (req.weight() != null) i.setWeight(req.weight());
        return repo.save(i);
    }

    @Transactional
    public Interest update(UUID userId, UUID id, InterestRequest req) {
        Interest i = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Interest not found"));
        if (req.weight() != null) i.setWeight(req.weight());
        i.setUpdatedAt(Instant.now());
        return repo.save(i);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Interest i = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Interest not found"));
        repo.delete(i);
    }
}
