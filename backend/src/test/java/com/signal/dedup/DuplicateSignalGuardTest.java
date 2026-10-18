package com.signal.dedup;

import com.signal.ai.EmbeddingProvider;
import com.signal.ingestion.entity.Information;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Same-event suppression. The interesting cases are the edges: a similarity just under the
 * threshold must NOT suppress (silently swallowing a real story is worse than showing it
 * twice), and a failing embedding provider must degrade to "not a duplicate".
 */
class DuplicateSignalGuardTest {

    private final EmbeddingProvider embeddings = mock(EmbeddingProvider.class);
    private final InformationEmbeddingStore store = mock(InformationEmbeddingStore.class);
    private final DuplicateSignalGuard guard = new DuplicateSignalGuard(embeddings, store, 0.85);

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID());
        i.setUserId(UUID.randomUUID());
        i.setTitle("PostgreSQL picks B-Tree over LSM-Tree");
        i.setExcerpt("An explainer of the trade-off.");
        return i;
    }

    private void embeddingSucceeds() {
        when(embeddings.embed(anyString())).thenReturn(List.of(0.1, 0.2, 0.3));
        when(embeddings.model()).thenReturn("test-embed");
    }

    @Test void aboveThresholdIsADuplicate() {
        embeddingSucceeds();
        UUID anchor = UUID.randomUUID();
        when(store.nearestOther(any(), any(), any()))
                .thenReturn(Optional.of(new InformationEmbeddingStore.Match(anchor, 0.93, "same")));

        var found = guard.duplicateOf(UUID.randomUUID(), info());

        assertTrue(found.isPresent());
        assertEquals(anchor, found.get().informationId());
    }

    @Test void justBelowThresholdIsNotADuplicate() {
        embeddingSucceeds();
        when(store.nearestOther(any(), any(), any()))
                .thenReturn(Optional.of(new InformationEmbeddingStore.Match(UUID.randomUUID(), 0.849, "similar")));

        assertTrue(guard.duplicateOf(UUID.randomUUID(), info()).isEmpty());
    }

    @Test void theEmbeddingIsStoredSoTheItemCanAnchorLaterEvents() {
        embeddingSucceeds();
        when(store.nearestOther(any(), any(), any())).thenReturn(Optional.empty());

        Information i = info();
        guard.duplicateOf(i.getUserId(), i);

        verify(store).save(eq(i.getId()), any(), eq("test-embed"));
    }

    @Test void embeddingFailureDegradesToNotADuplicate() {
        when(embeddings.embed(anyString())).thenThrow(new IllegalStateException("provider down"));

        assertTrue(guard.duplicateOf(UUID.randomUUID(), info()).isEmpty());
        verify(store, never()).save(any(), any(), anyString());
    }

    @Test void lookupFailureDegradesToNotADuplicate() {
        embeddingSucceeds();
        when(store.nearestOther(any(), any(), any())).thenThrow(new IllegalStateException("db down"));

        assertTrue(guard.duplicateOf(UUID.randomUUID(), info()).isEmpty());
    }

    @Test void corroborationJoinsTheAnchorsCluster() {
        UUID cluster = UUID.randomUUID();
        when(store.clusterFor(any(), any(), anyString(), anyDouble())).thenReturn(cluster);

        Information dup = info();
        var anchor = new InformationEmbeddingStore.Match(UUID.randomUUID(), 0.91, "the same story");
        guard.corroborate(dup.getUserId(), anchor, dup);

        verify(store).clusterFor(dup.getUserId(), anchor.informationId(), "the same story", 0.91);
        verify(store).link(cluster, dup.getId(), 0.91);
    }

    /** Recording corroboration is observability, not correctness — it must not fail the run. */
    @Test void corroborationFailureIsSwallowed() {
        when(store.clusterFor(any(), any(), anyString(), anyDouble()))
                .thenThrow(new IllegalStateException("db down"));

        Information dup = info();
        assertDoesNotThrow(() -> guard.corroborate(dup.getUserId(),
                new InformationEmbeddingStore.Match(UUID.randomUUID(), 0.9, "t"), dup));
    }
}
