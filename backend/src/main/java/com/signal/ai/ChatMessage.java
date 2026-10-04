package com.signal.ai;

/** Role-tagged message. Content roles must never be mixed: untrusted info is always USER. */
public record ChatMessage(Role role, String content) {
    public enum Role { SYSTEM, USER }

    public static ChatMessage system(String content) { return new ChatMessage(Role.SYSTEM, content); }
    public static ChatMessage user(String content) { return new ChatMessage(Role.USER, content); }
}
