package com.signal.knowledge;

import com.signal.ai.AIProperties;
import com.signal.ai.EmbeddingProvider;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChunkServiceTest {

    /** Expected vector width — mirrors the DB schema (V17 = 1024). */
    private static final int DIMENSIONS = AIProperties.DEFAULT_EMBEDDING_DIMENSIONS;

    /** Deterministic fake provider recording what it embedded. */
    static class RecordingEmbedder implements EmbeddingProvider {
        final List<String> seen = new ArrayList<>();
        int dims = DIMENSIONS;
        boolean fail = false;
        @Override public List<Double> embed(String text) {
            if (fail) throw new RuntimeException("provider down");
            seen.add(text);
            List<Double> v = new ArrayList<>(dims);
            for (int i = 0; i < dims; i++) v.add(0.001 * (i + 1));
            return v;
        }
        @Override public String model() { return "recording"; }
    }

    private final RecordingEmbedder embedder = new RecordingEmbedder();
    private final ChunkStore store = mock(ChunkStore.class);
    private final InformationRepository information = mock(InformationRepository.class);
    private final InformationUnderstandingRepository understandings = mock(InformationUnderstandingRepository.class);

    private ChunkService svc(int max, int overlap) {
        when(understandings.findByInformationId(any())).thenReturn(Optional.empty());
        return new ChunkService(embedder, store, information, understandings, max, overlap, DIMENSIONS);
    }

    private static Information info(String title, String content, String excerpt) {
        Information i = new Information();
        i.setId(UUID.randomUUID());
        i.setUserId(UUID.randomUUID());
        i.setTitle(title);
        i.setContent(content);
        i.setExcerpt(excerpt);
        return i;
    }

    @Test void shortTextSingleChunk() {
        List<String> parts = svc(800, 150).split("Hello world.");
        assertEquals(1, parts.size());
        assertEquals("Hello world.", parts.get(0));
    }

    @Test void blankTextYieldsNoChunks() {
        assertTrue(svc(800, 150).split("   \n  ").isEmpty());
        assertTrue(svc(800, 150).split(null).isEmpty());
    }

    @Test void paragraphsAccumulateWithinLimitAndSplitAtBoundary() {
        String p1 = "A".repeat(500);
        String p2 = "B".repeat(500);
        String p3 = "C".repeat(300);
        List<String> parts = svc(800, 150).split(p1 + "\n\n" + p2 + "\n\n" + p3);
        assertTrue(parts.size() >= 2);
        for (String s : parts) assertTrue(s.length() <= 800, "chunk over limit: " + s.length());
        // paragraph 1+3 (800 exactly) must not merge across p2
        assertEquals(p1, parts.get(0));
    }

    @Test void consecutiveChunksShareTailOverlap() {
        String p1 = "A".repeat(600);
        String p2 = "B".repeat(600);
        List<String> parts = svc(800, 150).split(p1 + "\n\n" + p2);
        assertEquals(2, parts.size());
        String first = parts.get(0), second = parts.get(1);
        // second starts with the last 150 chars of the first
        assertTrue(second.startsWith(first.substring(first.length() - 150)),
                "expected tail overlap, second starts: " + second.substring(0, Math.min(40, second.length())));
    }

    @Test void oversizeParagraphHardSplitsWithOverlap() {
        String big = "X".repeat(2000);
        List<String> parts = svc(800, 150).split(big);
        assertTrue(parts.size() >= 3);
        for (String s : parts) assertTrue(s.length() <= 800);
        for (int i = 1; i < parts.size(); i++) {
            String prev = parts.get(i - 1);
            assertTrue(parts.get(i).startsWith(prev.substring(prev.length() - 150)),
                    "hard-split overlap missing at chunk " + i);
        }
    }

    @Test void buildTextTitleSummaryContent() {
        Information i = info("Release Notes", "Full body text.", "ignored excerpt");
        InformationUnderstanding u = new InformationUnderstanding();
        u.setSummary("AI summary line");
        ChunkService s = svc(800, 150); // registers any() default first…
        when(understandings.findByInformationId(i.getId())).thenReturn(Optional.of(u)); // …then the specific wins
        String text = s.buildText(i);
        assertTrue(text.contains("Release Notes"));
        assertTrue(text.contains("AI summary line"));
        assertTrue(text.contains("Full body text."));
        assertTrue(text.indexOf("Release Notes") < text.indexOf("AI summary line"));
    }

    @Test void buildTextFallsBackToExcerptWhenContentBlank() {
        Information i = info("T", "   ", "excerpt body");
        String text = svc(800, 150).buildText(i);
        assertTrue(text.contains("excerpt body"));
        assertFalse(text.contains("null"));
    }

    @Test void chunkInformationEmbedsAndPersists() {
        Information i = info("T", "body content here", null);
        when(understandings.findByInformationId(any())).thenReturn(Optional.empty());
        int n = svc(800, 150).chunkInformation(i);
        assertEquals(1, n);
        assertEquals(1, embedder.seen.size());
        verify(store).replace(eq(i), argThat(list -> list.size() == 1
                && list.get(0).embedding() != null && list.get(0).embedding().size() == DIMENSIONS
                && "recording".equals(list.get(0).model())));
    }

    @Test void embeddingFailureStillPersistsKeywordOnlyChunk() {
        embedder.fail = true;
        Information i = info("T", "body", null);
        int n = svc(800, 150).chunkInformation(i);
        assertEquals(1, n);
        verify(store).replace(eq(i), argThat(list -> list.get(0).embedding() == null));
        embedder.fail = false;
    }

    @Test void wrongDimensionalityFailsLoudly() {
        embedder.dims = 8;
        Information i = info("T", "body", null);
        assertThrows(IllegalStateException.class, () -> svc(800, 150).chunkInformation(i));
        verify(store, never()).replace(any(), any());
        embedder.dims = DIMENSIONS;
    }

    @Test void emptyCorpusClearsChunks() {
        Information i = info(null, "", "");
        int n = svc(800, 150).chunkInformation(i);
        assertEquals(0, n);
        verify(store).replace(eq(i), argThat(List::isEmpty));
    }
}
