package com.signal.goal.service;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.goal.dto.GoalRequest;
import com.signal.goal.entity.Goal;
import com.signal.goal.repository.GoalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class GoalService {

    private final GoalRepository repo;

    public GoalService(GoalRepository repo) { this.repo = repo; }

    @Transactional(readOnly = true)
    public List<Goal> list(UUID userId) { return repo.findAllByUserIdOrderByCreatedAtDesc(userId); }

    @Transactional(readOnly = true)
    public Goal get(UUID userId, UUID id) {
        return repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal not found"));
    }

    @Transactional
    public Goal create(UUID userId, GoalRequest req) {
        Goal g = new Goal();
        g.setUserId(userId);
        g.setTitle(req.title().trim());
        g.setDescription(req.description());
        if (req.priority() != null) g.setPriority(req.priority());
        return repo.save(g);
    }

    @Transactional
    public Goal update(UUID userId, UUID id, GoalRequest req) {
        Goal g = get(userId, id);
        if (req.title() != null) g.setTitle(req.title().trim());
        if (req.description() != null) g.setDescription(req.description());
        if (req.priority() != null) g.setPriority(req.priority());
        g.setUpdatedAt(Instant.now());
        return repo.save(g);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Goal g = get(userId, id); // throws if not owned → IDOR safe
        repo.delete(g);
    }
}
