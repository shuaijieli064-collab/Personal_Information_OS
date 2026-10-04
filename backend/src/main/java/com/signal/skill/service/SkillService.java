package com.signal.skill.service;

import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.skill.dto.SkillRequest;
import com.signal.skill.entity.Skill;
import com.signal.skill.repository.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SkillService {

    private final SkillRepository repo;

    public SkillService(SkillRepository repo) { this.repo = repo; }

    static String normalize(String s) { return s.trim().toLowerCase(); }

    @Transactional(readOnly = true)
    public List<Skill> list(UUID userId) { return repo.findAllByUserIdOrderByUpdatedAtDesc(userId); }

    @Transactional
    public Skill create(UUID userId, SkillRequest req) {
        String norm = normalize(req.name());
        if (repo.existsByUserIdAndNormalizedName(userId, norm)) {
            throw new DuplicateResourceException("Skill already exists");
        }
        Skill s = new Skill();
        s.setUserId(userId);
        s.setName(req.name().trim());
        s.setNormalizedName(norm);
        if (req.level() != null) s.setLevel(req.level());
        return repo.save(s);
    }

    @Transactional
    public Skill update(UUID userId, UUID id, SkillRequest req) {
        Skill s = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));
        if (req.level() != null) s.setLevel(req.level());
        s.setUpdatedAt(Instant.now());
        return repo.save(s);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Skill s = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));
        repo.delete(s);
    }
}
