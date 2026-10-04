package com.signal.understanding;

import java.util.Arrays;

/** Stable, small taxonomy. Model output must be one of these. */
public enum Classification {
    NEWS, TECHNOLOGY, RESEARCH, PRODUCT, TUTORIAL, RELEASE, JOB, EVENT, ANNOUNCEMENT, OTHER;

    public static boolean isValid(String v) {
        return v != null && Arrays.stream(values()).anyMatch(c -> c.name().equalsIgnoreCase(v));
    }

    public static Classification normalize(String v) {
        return valueOf(v.toUpperCase());
    }
}
