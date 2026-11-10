package com.signal.discover;

import com.signal.ai.AIProvider;
import com.signal.ai.ChatMessage;
import com.signal.discover.dto.DiscoverResult;
import com.signal.goal.entity.Goal;
import com.signal.goal.repository.GoalRepository;
import com.signal.ingestion.entity.Source;
import com.signal.ingestion.repository.SourceRepository;
import com.signal.interest.entity.Interest;
import com.signal.interest.repository.InterestRepository;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The suggest pipeline: the model proposes, the verifier disposes. Every failure —
 * model down, unparseable answer, unverified candidate — must degrade honestly instead
 * of a fabricated recommendation.
 */
class DiscoverServiceTest {

    /** Records the prompt it received; answers only from the script. */
    private static class FakeAI implements AIProvider {
        List<ChatMessage> lastRequest;
        String answer = "{}";
        boolean fail = false;

        @Override public String chat(ChatRequest request) { return answer; }
        @Override public String structuredOutput(ChatRequest request) {
            lastRequest = request.messages();
            if (fail) throw new RuntimeException("model down");
            return answer;
        }
        @Override public String name() { return "fake-ai"; }

        String prompt() {
            return lastRequest == null ? ""
                    : lastRequest.stream().map(m -> m.content().toString()).reduce("", (a, b) -> a + b);
        }
    }

    /** Answers the verifier's verdict from a per-URL script, never hitting the network. */
    private static class ScriptedVerifier extends CandidateVerifier {
        private final Map<String, Boolean> verdicts = new HashMap<>();

        ScriptedVerifier() { super(null, null, "https://api.github.test"); }

        ScriptedVerifier live(String url) { verdicts.put(url, true); return this; }

        @Override public boolean verify(String type, String url) {
            return verdicts.getOrDefault(url, false);
        }
    }

    private final GoalRepository goals = mock(GoalRepository.class);
    private final InterestRepository interests = mock(InterestRepository.class);
    private final SourceRepository sources = mock(SourceRepository.class);
    private final FakeAI ai = new FakeAI();
    private final ScriptedVerifier verifier = new ScriptedVerifier();

    private final DiscoverService service = new DiscoverService(ai, goals, interests, sources, verifier);

    private final UUID user = UUID.randomUUID();

    DiscoverServiceTest() {
        when(goals.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of());
        when(interests.findAllByUserIdOrderByUpdatedAtDesc(user)).thenReturn(List.of());
        when(sources.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of());
    }

    private void modelAnswers(String... urlsAndTypes) {
        StringBuilder sb = new StringBuilder("{\"suggestions\":[");
        int n = 1;
        for (int i = 0; i < urlsAndTypes.length; i += 2) {
            sb.append("{\"title\":\"S").append(n)
                    .append("\",\"url\":\"").append(urlsAndTypes[i])
                    .append("\",\"type\":\"").append(urlsAndTypes[i + 1])
                    .append("\",\"reason\":\"个人化理由\"},");
            n++;
        }
        if (urlsAndTypes.length > 0) sb.setLength(sb.length() - 1);
        ai.answer = sb.append("]}").toString();
    }

    // ── happy path ──────────────────────────────────────────────────────────────

    @Test
    void onlyLiveVerifiedCandidatesSurvive() {
        modelAnswers("https://f.test/feed.xml", "RSS", "https://github.com/a/b", "GITHUB");
        verifier.live("https://f.test/feed.xml"); // the github one fails the live check

        DiscoverResult r = service.suggest(user, "关注向量数据库", 5);

        assertNull(r.fallback());
        assertEquals(1, r.suggestions().size());
        assertEquals("https://f.test/feed.xml", r.suggestions().get(0).url());
        assertEquals("RSS", r.suggestions().get(0).type());
        assertEquals("个人化理由", r.suggestions().get(0).reason());
    }

    @Test
    void theQueryTravelsInTheUntrustedChannelWithThePromptShape() {
        modelAnswers("https://f.test/feed.xml", "RSS");
        verifier.live("https://f.test/feed.xml");

        service.suggest(user, "关注向量数据库", 5);

        String prompt = ai.prompt();
        assertTrue(prompt.contains("关注向量数据库"), "the query must reach the model");
        assertTrue(prompt.contains("UNTRUSTED"), "the query must be marked untrusted");
        assertTrue(prompt.contains("suggestions"), "the JSON shape must be in the instructions");
    }

    @Test
    void profileContextReachesTheModelWhenThereIsAny() {
        modelAnswers("https://f.test/feed.xml", "RSS");
        verifier.live("https://f.test/feed.xml");
        Goal g = new Goal();
        g.setTitle("读完 DDIA");
        when(goals.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of(g));

        service.suggest(user, "q", 5);

        assertTrue(ai.prompt().contains("读完 DDIA"), "goals must personalise the suggestion prompt");
    }

    @Test
    void fakeTypesAndNonHttpUrlsDieBeforeVerification() {
        modelAnswers("https://f.test/feed.xml", "URL", "javascript:alert(1)", "RSS");
        verifier.live("https://f.test/feed.xml");

        DiscoverResult r = service.suggest(user, "q", 5);

        assertEquals(0, r.suggestions().size());
        assertNull(r.fallback()); // honest empty ≠ degraded
    }

    @Test
    void existingSourcesAreNotReSuggested() {
        modelAnswers("https://f.test/feed.xml", "RSS");
        verifier.live("https://f.test/feed.xml");
        Source mine = new Source();
        mine.setUrl("https://f.test/feed.xml/");
        when(sources.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of(mine));

        DiscoverResult r = service.suggest(user, "q", 5);

        assertEquals(0, r.suggestions().size(), "a source the user already has is noise");
    }

    @Test
    void limitClampsTheNumberOfVerifiedResults() {
        modelAnswers("https://a.test/feed.xml", "RSS",
                "https://b.test/feed.xml", "RSS", "https://c.test/feed.xml", "RSS");
        verifier.live("https://a.test/feed.xml").live("https://b.test/feed.xml")
                .live("https://c.test/feed.xml");

        DiscoverResult r = service.suggest(user, "q", 1);

        assertEquals(1, r.suggestions().size());
    }

    @Test
    void aNullLimitClampsToTheModelCap() {
        modelAnswers("https://a.test/feed.xml", "RSS", "https://b.test/feed.xml", "RSS",
                "https://c.test/feed.xml", "RSS", "https://d.test/feed.xml", "RSS",
                "https://e.test/feed.xml", "RSS", "https://g.test/feed.xml", "RSS");
        for (String s : List.of("a", "b", "c", "d", "e", "g")) {
            verifier.live("https://" + s + ".test/feed.xml");
        }

        DiscoverResult r = service.suggest(user, "q", null);

        assertEquals(5, r.suggestions().size(), "at most five, even if the model ignores the cap");
    }

    // ── degradation ─────────────────────────────────────────────────────────────

    @Test
    void aModelFailureDegradesToAManualFallback() {
        ai.fail = true;

        DiscoverResult r = service.suggest(user, "q", 5);

        assertTrue(r.suggestions().isEmpty());
        assertEquals("manual", r.fallback());
    }

    @Test
    void anUnparseableAnswerDegradesToAManualFallback() {
        ai.answer = "I am not JSON at all";

        DiscoverResult r = service.suggest(user, "q", 5);

        assertEquals("manual", r.fallback());
        assertTrue(r.suggestions().isEmpty());
    }

    @Test
    void anAnswerWithoutTheSuggestionsArrayDegradesToAManualFallback() {
        ai.answer = "{\"verdict\":\"no\"}";

        DiscoverResult r = service.suggest(user, "q", 5);

        assertEquals("manual", r.fallback());
        assertTrue(r.suggestions().isEmpty());
    }

    @Test
    void everythingUnverifiedIsAnHonestEmptyList() {
        modelAnswers("https://x.test/feed.xml", "RSS");

        DiscoverResult r = service.suggest(user, "q", 5);

        assertNull(r.fallback());
        assertTrue(r.suggestions().isEmpty());
    }
}
