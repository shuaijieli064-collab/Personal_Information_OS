package com.signal.brief.dto;

import com.signal.brief.entity.Notification;

import java.time.Instant;
import java.util.UUID;

/**
 * Wire shape of a notification. These field names are part of the contract the frontend
 * is built against — do not rename them.
 */
public record NotificationDto(
        UUID id,
        String type,
        String title,
        String body,
        boolean read,
        String payload,
        Instant createdAt) {

    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.isRead(), n.getPayload(), n.getCreatedAt());
    }
}
