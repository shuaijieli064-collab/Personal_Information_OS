package com.signal.understanding;

import com.signal.goal.entity.Goal;
import com.signal.goal.repository.GoalRepository;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.interest.entity.Interest;
import com.signal.interest.repository.InterestRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import com.signal.understanding.service.RelevanceService;
import com.signal.understanding.service.RelevanceService.Relevance;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RelevanceServiceTest {

    private final InformationRepository infoRepo = mock(InformationRepository.class);
    private final InformationUnderstandingRepository repo = mock(InformationUnderstandingRepository.class);
    private final GoalRepository goalRepo = mock(GoalRepository.class);
    private final InterestRepository interestRepo = mock(InterestRepository.class);

    private Information info(String title) {
        Information i = new Information();
        i.setId(UUID.randomUUID()); i.setUserId(UUID.randomUUID());
        i.setTitle(title); i.setContent("body");
        return i;
    }

    /** The matcher's own output — what the scorer and the reason-writer consume. */
    private Relevance compute(Information i, List<Goal> goals, List<Interest> interests) {
        when(goalRepo.findAllByUserIdOrderByCreatedAtDesc(i.getUserId())).thenReturn(goals);
        when(interestRepo.findAllByUserIdOrderByUpdatedAtDesc(i.getUserId())).thenReturn(interests);
        return new RelevanceService(infoRepo, repo, goalRepo, interestRepo)
                .compute(i.getUserId(), i.getTitle(), i.getContent());
    }

    private InformationUnderstanding run(Information i, List<Goal> goals, List<Interest> interests) {
        when(infoRepo.findByIdAndUserId(any(), any())).thenReturn(Optional.of(i));
        when(goalRepo.findAllByUserIdOrderByCreatedAtDesc(i.getUserId())).thenReturn(goals);
        when(interestRepo.findAllByUserIdOrderByUpdatedAtDesc(i.getUserId())).thenReturn(interests);
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));
        new RelevanceService(infoRepo, repo, goalRepo, interestRepo).score(i.getUserId(), i.getId());
        ArgumentCaptor<InformationUnderstanding> cap = ArgumentCaptor.forClass(InformationUnderstanding.class);
        verify(repo).save(cap.capture());
        return cap.getValue();
    }

    @Test void noContextGivesBaseline() {
        Relevance r = compute(info(" unrelated thing "), List.of(), List.of());
        assertTrue(r.score() >= 20);
        assertFalse(r.goalMatched());
        assertNull(r.matchedGoal());
        assertTrue(r.matchedInterests().isEmpty());
    }

    @Test void matchingGoalBoosts() {
        Goal g = new Goal(); g.setTitle("Java Backend");
        Relevance r = compute(info("Learn Java Backend with Spring"), List.of(g), List.of());
        assertTrue(r.score() > 50);
        assertTrue(r.goalMatched());
        assertEquals("Java Backend", r.matchedGoal());
    }

    @Test void matchingInterestBoosts() {
        Interest i = new Interest(); i.setName("AI");
        Relevance r = compute(info("New AI Agent framework"), List.of(), List.of(i));
        assertTrue(r.score() > 20);
        assertEquals(1, r.interestMatches());
        assertEquals(List.of("AI"), r.matchedInterests());
    }

    /**
     * The matcher must never write prose. It used to persist "Matches your goal: X" —
     * English machine text shown in every locale's most prominent slot.
     */
    @Test void matcherPersistsNoProse() {
        Goal g = new Goal(); g.setTitle("Java Backend");
        InformationUnderstanding r = run(info("Learn Java Backend"), List.of(g), List.of());
        assertNull(r.getWhyRelevant());
        assertEquals("COMPLETED", r.getStatus());
    }
}
