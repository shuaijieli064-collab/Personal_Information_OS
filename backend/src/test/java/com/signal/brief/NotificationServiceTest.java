package com.signal.brief;

import com.signal.brief.dto.NotificationDto;
import com.signal.brief.entity.Notification;
import com.signal.brief.repository.NotificationRepository;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * The inbox service: dedupe of important-signal alerts, user-scoped reads, and the unread
 * count. No DB, no network.
 */
class NotificationServiceTest {

    private final NotificationRepository repo = mock(NotificationRepository.class);
    private final SignalRepository signals = mock(SignalRepository.class);
    private final WebhookNotifier webhook = mock(WebhookNotifier.class);
    private final NotificationService service = new NotificationService(repo, signals, webhook);

    private final UUID user = UUID.randomUUID();

    private Signal signal(UUID id) {
        Signal s = new Signal();
        s.setId(id);
        s.setUserId(user);
        s.setTitle("An important signal");
        s.setStatus("IMPORTANT");
        return s;
    }

    private Notification notification(boolean read) {
        Notification n = new Notification();
        n.setId(UUID.randomUUID());
        n.setUserId(user);
        n.setType("DAILY_BRIEF");
        n.setTitle("t");
        n.setRead(read);
        return n;
    }

    // ── important-signal dedupe ─────────────────────────────────────────────────

    @Test
    void theSameImportantSignalIsNeverNotifiedTwice() {
        Signal s = signal(UUID.randomUUID());
        when(signals.findByUserIdAndStatus(user, "IMPORTANT")).thenReturn(List.of(s));

        // Stateful repo stub: once a payload is saved, it counts as already notified.
        Set<String> notified = new HashSet<>();
        when(repo.existsByUserIdAndTypeAndPayload(eq(user), eq("IMPORTANT_SIGNAL"), any()))
                .thenAnswer(inv -> notified.contains(inv.getArgument(2)));
        when(repo.save(any(Notification.class))).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            notified.add(n.getPayload());
            return n;
        });

        assertEquals(1, service.notifyImportantSignals(user));
        assertEquals(0, service.notifyImportantSignals(user), "the signal was already announced");
        verify(repo, times(1)).save(any(Notification.class));
    }

    @Test
    void notifyJobFailedRaisesAJobFailedNotification() {
        when(repo.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationDto dto = service.notifyJobFailed(user, "SOURCE_SYNC", "boom");

        assertEquals("JOB_FAILED", dto.type());
        assertTrue(dto.title().contains("SOURCE_SYNC"));
        assertEquals("boom", dto.body());
        verify(webhook).push("JOB_FAILED", dto.title(), "boom");
    }

    // ── user scoping ────────────────────────────────────────────────────────────

    @Test
    void markReadOfAnotherUsersNotificationIsNotFound() {
        when(repo.findByIdAndUserId(any(), eq(user))).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.markRead(user, UUID.randomUUID()));
    }

    @Test
    void markReadMarksTheNotificationRead() {
        Notification n = notification(false);
        when(repo.findByIdAndUserId(n.getId(), user)).thenReturn(Optional.of(n));
        when(repo.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationDto dto = service.markRead(user, n.getId());

        assertTrue(dto.read());
        assertTrue(n.isRead());
    }

    @Test
    void markAllReadMarksEveryUnread() {
        Notification a = notification(false);
        Notification b = notification(false);
        when(repo.findByUserIdAndReadFalse(user)).thenReturn(List.of(a, b));
        when(repo.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        assertEquals(2, service.markAllRead(user));
        assertTrue(a.isRead());
        assertTrue(b.isRead());
    }

    @Test
    void unreadCountDelegatesToTheRepository() {
        when(repo.countByUserIdAndReadFalse(user)).thenReturn(3L);
        assertEquals(3L, service.unreadCount(user));
    }

    @Test
    void listReturnsItemsTotalAndUnreadCount() {
        Notification n = notification(false);
        when(repo.findByUserIdOrderByCreatedAtDesc(eq(user), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(n)));
        when(repo.countByUserIdAndReadFalse(user)).thenReturn(1L);

        var page = service.list(user, false, 0, 20);

        assertEquals(1, page.items().size());
        assertEquals(1, page.total());
        assertEquals(1L, page.unreadCount());
    }
}
