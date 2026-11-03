package com.signal.ingestion.service;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.pipeline.NormalizedItem;
import com.signal.ingestion.repository.SourceRepository;
import com.signal.knowledge.ChunkService;
import com.signal.understanding.service.InformationUnderstandingService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The sync request path is bounded. Auto-understanding and auto-chunking each process
 * at most N new items — a real provider turns every item (and every chunk) into an
 * HTTP round-trip on the request thread. These tests pin the caps so a future change
 * cannot silently grow the request into a minutes-long embedding batch; the remainder
 * is covered by POST /api/v1/knowledge/reindex.
 */
class IngestionServiceTest {

    private final SourceRepository sources = mock(SourceRepository.class);
    private final IngestionPersister persister = mock(IngestionPersister.class);
    private final InformationUnderstandingService understanding =
            mock(InformationUnderstandingService.class);
    private final ChunkService chunks = mock(ChunkService.class);

    private final UUID userId = UUID.randomUUID();
    private final Source source = newSource();

    private Source newSource() {
        Source s = new Source();
        s.setId(UUID.randomUUID());
        s.setUserId(userId);
        s.setType("RSS");
        s.setUrl("https://example.com/feed.xml");
        return s;
    }

    private IngestionService service(int understandLimit, int chunkLimit, List<UUID> createdIds) {
        when(persister.persist(eq(source), any())).thenReturn(new IngestionService.SyncResult(
                source.getId(), createdIds.size(), createdIds.size(), 0, 0, 0, createdIds, null));
        return new IngestionService(List.of(), sources, persister, understanding, chunks,
                understandLimit, chunkLimit);
    }

    private static NormalizedItem item() {
        return new NormalizedItem("ext-1", "title", "content", "excerpt",
                "https://example.com/a", "author", null, "ARTICLE", null, Map.of());
    }

    @Test
    void chunkingIsCappedOnTheRequestPath() {
        List<UUID> created = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID());
        service(20, 2, created).persistDirect(source, item());
        verify(chunks).chunkIds(eq(userId),
                argThat(ids -> ids.size() == 2 && ids.equals(created.subList(0, 2))));
    }

    @Test
    void underTheCapEveryNewItemIsChunked() {
        List<UUID> created = List.of(UUID.randomUUID(), UUID.randomUUID());
        service(20, 20, created).persistDirect(source, item());
        verify(chunks).chunkIds(eq(userId), argThat(ids -> ids.equals(created)));
    }

    @Test
    void zeroCapDisablesTheStepOnTheRequestPath() {
        List<UUID> created = List.of(UUID.randomUUID());
        service(20, 0, created).persistDirect(source, item());
        verify(chunks, never()).chunkIds(any(), any());
    }

    @Test
    void theTwoCapsAreIndependent() {
        List<UUID> created = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        service(1, 2, created).persistDirect(source, item());
        verify(understanding, times(1)).process(eq(userId), any(UUID.class));
        verify(chunks).chunkIds(eq(userId), argThat(ids -> ids.size() == 2));
    }
}
