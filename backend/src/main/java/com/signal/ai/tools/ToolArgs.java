package com.signal.ai.tools;

import java.util.Map;
import java.util.UUID;

/**
 * Small, shared argument reader for tool implementations. Centralising it keeps the
 * "missing required argument → {@link ToolInvocationException}" contract identical across
 * every tool, instead of each one inventing its own null handling.
 */
final class ToolArgs {

    private ToolArgs() {}

    /** A required non-blank string argument. */
    static String requiredString(Map<String, Object> args, String name) {
        Object raw = args == null ? null : args.get(name);
        if (raw == null) throw new ToolInvocationException("Missing required argument: " + name);
        String value = String.valueOf(raw).trim();
        if (value.isEmpty()) throw new ToolInvocationException("Missing required argument: " + name);
        return value;
    }

    /** A required argument parsed as a UUID; a non-UUID value is a bad argument type. */
    static UUID requiredUuid(Map<String, Object> args, String name) {
        String value = requiredString(args, name);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw new ToolInvocationException("Argument '" + name + "' is not a valid UUID: " + value);
        }
    }

    /** An optional string argument; blank becomes {@code null}. */
    static String optionalString(Map<String, Object> args, String name) {
        Object raw = args == null ? null : args.get(name);
        if (raw == null) return null;
        String value = String.valueOf(raw).trim();
        return value.isEmpty() ? null : value;
    }

    /** An optional integer argument clamped to {@code [min, max]}; absent / unparseable → {@code def}. */
    static int optionalInt(Map<String, Object> args, String name, int def, int min, int max) {
        Object raw = args == null ? null : args.get(name);
        if (raw == null) return def;
        int value;
        if (raw instanceof Number n) {
            value = n.intValue();
        } else {
            try {
                value = Integer.parseInt(String.valueOf(raw).trim());
            } catch (NumberFormatException e) {
                return def;
            }
        }
        return Math.max(min, Math.min(value, max));
    }
}
