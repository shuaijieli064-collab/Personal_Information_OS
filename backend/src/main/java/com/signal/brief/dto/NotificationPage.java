package com.signal.brief.dto;

import java.util.List;

/** Paged inbox: the page's items, the total the filter matches, and the unread badge. */
public record NotificationPage(List<NotificationDto> items, long total, long unreadCount) {}
