package com.signal.security.ratelimit;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window request limiter held in process memory.
 *
 * <p>Why not Redis: the backend runs as a single instance and CI has no Redis, so an
 * in-memory window is exact for today's topology and puts no network hop on the request
 * path. If the service is ever scaled out, this class is the one seam to swap for a
 * shared counter — callers only depend on {@link #check}.
 *
 * <p>A sliding window (timestamps of recent hits) is used rather than a fixed bucket:
 * a fixed bucket lets a client spend a full allowance at 59s and again at 61s, which
 * halves the effective protection against a brute-force sweep.
 *
 * <p>Not a bean: it is owned by {@link RateLimitFilter}, which is what a test slice
 * loads. The clock is injectable so window expiry can be asserted without sleeping.
 */
public class SlidingWindowRateLimiter {

    /** Outcome of one attempt: allowed plus what is left, or how long to wait. */
    public record Decision(boolean allowed, int remaining, long retryAfterSeconds) {

        static Decision allow(int remaining) {
            return new Decision(true, remaining, 0);
        }

        static Decision deny(long retryAfterSeconds) {
            return new Decision(false, 0, Math.max(1, retryAfterSeconds));
        }
    }

    private final Clock clock;
    private final int maxTrackedKeys;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter(Clock clock, int maxTrackedKeys) {
        this.clock = clock;
        this.maxTrackedKeys = maxTrackedKeys > 0 ? maxTrackedKeys : 20_000;
    }

    /**
     * Count one hit for {@code key} and decide whether it may proceed.
     *
     * @param limit requests allowed inside {@code windowSeconds}; 0 means unlimited
     */
    public Decision check(String key, int limit, long windowSeconds) {
        if (limit <= 0) return Decision.allow(0);

        long windowMillis = Math.max(1, windowSeconds) * 1000L;
        long now = clock.millis();

        Window window = windows.get(key);
        if (window == null) {
            // Bound the map before admitting a new key; an unbounded key space is the
            // classic way a per-IP limiter becomes the leak. If every entry is still
            // live we let this request through untracked rather than fail closed —
            // a limiter must never become the outage.
            if (windows.size() >= maxTrackedKeys) {
                evictIdle(now, windowMillis);
                if (windows.size() >= maxTrackedKeys) return Decision.allow(0);
            }
            window = windows.computeIfAbsent(key, k -> new Window());
        }
        return window.check(now, limit, windowMillis);
    }

    private void evictIdle(long now, long windowMillis) {
        windows.entrySet().removeIf(e -> e.getValue().isIdle(now, windowMillis));
    }

    /** Hits for a single key. Guarded by its own monitor: per-key contention only. */
    private static final class Window {

        private final ArrayDeque<Long> hits = new ArrayDeque<>();

        synchronized Decision check(long now, int limit, long windowMillis) {
            prune(now, windowMillis);
            if (hits.size() >= limit) {
                long waitMillis = hits.peekFirst() + windowMillis - now;
                return Decision.deny((waitMillis + 999) / 1000);
            }
            hits.addLast(now);
            return Decision.allow(limit - hits.size());
        }

        synchronized boolean isIdle(long now, long windowMillis) {
            return hits.isEmpty() || hits.peekLast() <= now - windowMillis;
        }

        private void prune(long now, long windowMillis) {
            long cutoff = now - windowMillis;
            while (!hits.isEmpty() && hits.peekFirst() <= cutoff) hits.pollFirst();
        }
    }
}
