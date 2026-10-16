package com.signal.task;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.repository.SourceRepository;
import com.signal.ingestion.service.IngestionService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * One dead feed must not stop the rest: the job isolates every source and reports the
 * partial success in its detail string.
 */
class SourceSyncJobTest {

    private final SourceRepository sources = mock(SourceRepository.class);
    private final IngestionService ingestion = mock(IngestionService.class);
    private final SourceSyncJob job = new SourceSyncJob(sources, ingestion);

    private final UUID user = UUID.randomUUID();

    private Source source(boolean active) {
        Source s = new Source();
        s.setId(UUID.randomUUID());
        s.setUserId(user);
        s.setType("RSS");
        s.setName("feed");
        s.setActive(active);
        return s;
    }

    @Test
    void oneFailingSourceDoesNotStopTheOthers() {
        Source a = source(true);
        Source b = source(true);
        Source c = source(true);
        Source d = source(true);
        when(sources.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of(a, b, c, d));
        doThrow(new RuntimeException("feed down")).when(ingestion).sync(user, b.getId());

        String detail = job.run(user);

        assertEquals("3 of 4 sources synced", detail);
        verify(ingestion).sync(user, a.getId());
        verify(ingestion).sync(user, b.getId());
        verify(ingestion).sync(user, c.getId());
        verify(ingestion).sync(user, d.getId()); // the source after the failure still ran
    }

    @Test
    void disabledSourcesAreSkipped() {
        Source on = source(true);
        Source off = source(false);
        when(sources.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of(on, off));

        String detail = job.run(user);

        assertEquals("1 of 1 sources synced", detail);
        verify(ingestion).sync(user, on.getId());
        verify(ingestion, never()).sync(user, off.getId());
    }

    @Test
    void noEnabledSourcesProducesAClearDetail() {
        when(sources.findAllByUserIdOrderByCreatedAtDesc(user)).thenReturn(List.of());

        assertEquals("No enabled sources to sync", job.run(user));
        verifyNoInteractions(ingestion);
    }
}
