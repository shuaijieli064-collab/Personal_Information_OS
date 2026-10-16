package com.signal.brief;

import com.signal.brief.dto.NotificationDto;
import com.signal.brief.dto.NotificationPage;
import com.signal.brief.entity.Notification;
import com.signal.brief.repository.NotificationRepository;
import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * The user's inbox: read/mark-as-read plus the two alerts the automation layer raises
 * (important signals, dead-lettered jobs).
 *
 * <p><b>Dedupe</b> is the load-bearing rule for {@code IMPORTANT_SIGNAL}: the loop that
 * raises them can run every few minutes, and a signal that is important stays important.
 * The signal id is written verbatim into {@code payload}, so an exact-match lookup is
 * enough to guarantee a signal is announced at most once — no in-memory state, no
 * ordering assumptions.
 */
@Service
public class NotificationService {

    public static final String TYPE_DAILY_BRIEF = "DAILY_BRIEF";
    public static final String TYPE_IMPORTANT_SIGNAL = "IMPORTANT_SIGNAL";
    public static final String TYPE_JOB_FAILED = "JOB_FAILED";

    private static final String STATUS_IMPORTANT = "IMPORTANT";

    private final NotificationRepository repo;
    private final SignalRepository signals;

    public NotificationService(NotificationRepository repo, SignalRepository signals) {
        this.repo = repo;
        this.signals = signals;
    }

    /** Newest-first page of the inbox; {@code unreadOnly} filters to unread. */
    @Transactional(readOnly = true)
    public NotificationPage list(UUID userId, boolean unreadOnly, int page, int size) {
        int p = Math.max(0, page);
        int s = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(p, s);
        Page<Notification> result = unreadOnly
                ? repo.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId, pageable)
                : repo.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        List<NotificationDto> items = result.getContent().stream().map(NotificationDto::from).toList();
        return new NotificationPage(items, result.getTotalElements(), repo.countByUserIdAndReadFalse(userId));
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return repo.countByUserIdAndReadFalse(userId);
    }

    /** Most recent notification of a type, or {@code null} — an empty inbox is not an error. */
    @Transactional(readOnly = true)
    public NotificationDto latest(UUID userId, String type) {
        return repo.findFirstByUserIdAndTypeOrderByCreatedAtDesc(userId, type)
                .map(NotificationDto::from)
                .orElse(null);
    }

    /** Marks one notification read. Not owned → 404 (never a silent no-op across users). */
    @Transactional
    public NotificationDto markRead(UUID userId, UUID id) {
        Notification n = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (!n.isRead()) {
            n.setRead(true);
            repo.save(n);
        }
        return NotificationDto.from(n);
    }

    /** Marks every unread notification read; returns how many changed. */
    @Transactional
    public int markAllRead(UUID userId) {
        List<Notification> unread = repo.findByUserIdAndReadFalse(userId);
        if (unread.isEmpty()) return 0;
        for (Notification n : unread) n.setRead(true);
        repo.saveAll(unread);
        return unread.size();
    }

    /**
     * Raises one IMPORTANT_SIGNAL notification per signal currently marked IMPORTANT that
     * has not been announced yet. Returns the number newly raised.
     */
    @Transactional
    public int notifyImportantSignals(UUID userId) {
        List<Signal> important = signals.findByUserIdAndStatus(userId, STATUS_IMPORTANT);
        int raised = 0;
        for (Signal s : important) {
            String payload = signalPayload(s.getId());
            if (repo.existsByUserIdAndTypeAndPayload(userId, TYPE_IMPORTANT_SIGNAL, payload)) continue;
            create(userId, TYPE_IMPORTANT_SIGNAL, s.getTitle(), s.getWhyItMatters(), payload);
            raised++;
        }
        return raised;
    }

    /** Raised when a job is dead-lettered (its consecutive failures hit the cap). */
    @Transactional
    public NotificationDto notifyJobFailed(UUID userId, String jobType, String error) {
        String title = "Scheduled job failed: " + jobType;
        return create(userId, TYPE_JOB_FAILED, title, error, jobFailedPayload(jobType));
    }

    /** Low-level create used by the two alerts above and by {@link BriefService}. */
    @Transactional
    public NotificationDto create(UUID userId, String type, String title, String body, String payload) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setPayload(payload);
        return NotificationDto.from(repo.save(n));
    }

    private static String signalPayload(UUID signalId) {
        return "{\"signalId\":\"" + signalId + "\"}";
    }

    private static String jobFailedPayload(String jobType) {
        return "{\"jobType\":\"" + jobType + "\"}";
    }
}
