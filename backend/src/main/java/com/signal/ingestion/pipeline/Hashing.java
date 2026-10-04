package com.signal.ingestion.pipeline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** SHA-256 helpers for EXACT dedup only — semantic dedup belongs to Phase 5. */
public final class Hashing {

    private Hashing() {}

    public static String sha256(String input) {
        if (input == null) input = "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(out.length * 2);
            for (byte b : out) sb.append(Character.forDigit((b >> 4) & 0xF, 16))
                                  .append(Character.forDigit(b & 0xF, 16));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Deterministic canonical key: trim, lowercase scheme/host, drop trailing slash. */
    public static String canonicalUrl(String url) {
        if (url == null || url.isBlank()) return "";
        String u = url.trim();
        int hash = u.indexOf('#');
        if (hash >= 0) u = u.substring(0, hash);
        if (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u;
    }
}
