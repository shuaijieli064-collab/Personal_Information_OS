package com.signal.common;

import java.util.List;

/** pgvector has no JPA type mapping, so vectors travel as their text literal and are cast in SQL. */
public final class Vectors {

    private Vectors() {}

    /** {@code [0.1,0.2,…]} — the form {@code CAST(? AS vector)} accepts. */
    public static String literal(List<Double> v) {
        StringBuilder sb = new StringBuilder(v.size() * 10).append('[');
        for (int i = 0; i < v.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(v.get(i));
        }
        return sb.append(']').toString();
    }
}
