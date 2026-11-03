package com.signal.security.ratelimit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class SlidingWindowRateLimiterTest {

    /** Clock the test moves by hand, so window expiry needs no {@code Thread.sleep}. */
    static final class MutableClock extends Clock {

        private long millis;

        MutableClock(long startMillis) {
            this.millis = startMillis;
        }

        void advanceSeconds(long seconds) {
            millis += seconds * 1000L;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis);
        }

        @Override
        public long millis() {
            return millis;
        }
    }

    private final MutableClock clock = new MutableClock(1_000_000L);
    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(clock, 100);

    @Test
    @DisplayName("allows exactly the limit, then refuses the next hit")
    void allowsLimitThenRefuses() {
        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.check("ip:1", 3, 60).allowed(), "hit " + i + " should pass");
        }

        SlidingWindowRateLimiter.Decision denied = limiter.check("ip:1", 3, 60);

        assertFalse(denied.allowed());
        assertEquals(60, denied.retryAfterSeconds(), "a full window is left to wait");
    }

    @Test
    @DisplayName("the window slides: the oldest hit frees its slot")
    void windowSlides() {
        for (int i = 0; i < 3; i++) assertTrue(limiter.check("ip:1", 3, 60).allowed());

        clock.advanceSeconds(59);
        assertFalse(limiter.check("ip:1", 3, 60).allowed(), "still inside the window");

        clock.advanceSeconds(2);
        assertTrue(limiter.check("ip:1", 3, 60).allowed(), "the oldest hit has expired");
    }

    @Test
    @DisplayName("retry-after counts down as the window empties")
    void retryAfterShrinks() {
        for (int i = 0; i < 2; i++) assertTrue(limiter.check("ip:1", 2, 60).allowed());

        clock.advanceSeconds(45);
        SlidingWindowRateLimiter.Decision denied = limiter.check("ip:1", 2, 60);

        assertFalse(denied.allowed());
        assertEquals(15, denied.retryAfterSeconds());
    }

    @Test
    @DisplayName("keys are independent — one flooding client does not lock out another")
    void keysAreIndependent() {
        for (int i = 0; i < 2; i++) assertTrue(limiter.check("ip:1", 2, 60).allowed());
        assertFalse(limiter.check("ip:1", 2, 60).allowed());

        assertTrue(limiter.check("ip:2", 2, 60).allowed());
    }

    @Test
    @DisplayName("remaining decrements and never goes negative")
    void remainingCountsDown() {
        assertEquals(2, limiter.check("ip:1", 3, 60).remaining());
        assertEquals(1, limiter.check("ip:1", 3, 60).remaining());
        assertEquals(0, limiter.check("ip:1", 3, 60).remaining());
        assertEquals(0, limiter.check("ip:1", 3, 60).remaining());
    }

    @Test
    @DisplayName("a limit of 0 means unlimited")
    void zeroLimitIsUnlimited() {
        for (int i = 0; i < 100; i++) assertTrue(limiter.check("ip:1", 0, 60).allowed());
    }

    @Test
    @DisplayName("concurrent hits can never exceed the limit")
    void concurrencyDoesNotOverAdmit() throws Exception {
        SlidingWindowRateLimiter shared = new SlidingWindowRateLimiter(Clock.systemUTC(), 100);
        int threads = 20;
        int hitsPerThread = 5;
        int limit = 10;
        AtomicInteger allowed = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);

        try {
            for (int t = 0; t < threads; t++) {
                pool.submit(() -> {
                    start.await();
                    for (int i = 0; i < hitsPerThread; i++) {
                        if (shared.check("ip:1", limit, 60).allowed()) allowed.incrementAndGet();
                    }
                    return null;
                });
            }
            start.countDown();
            pool.shutdown();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }

        assertEquals(limit, allowed.get(), "the window must admit exactly the limit under contention");
    }

    @Test
    @DisplayName("at key capacity, expired keys are dropped instead of leaking the map")
    void expiredKeysAreEvictedAtCapacity() {
        SlidingWindowRateLimiter small = new SlidingWindowRateLimiter(clock, 2);

        assertTrue(small.check("ip:1", 1, 60).allowed());
        assertTrue(small.check("ip:2", 1, 60).allowed());

        clock.advanceSeconds(61);

        // Capacity is reached, but both existing keys are now idle: they are evicted and
        // the new key is tracked normally, i.e. its own limit still applies.
        assertTrue(small.check("ip:3", 1, 60).allowed());
        assertFalse(small.check("ip:3", 1, 60).allowed());
    }

    @Test
    @DisplayName("a limiter at capacity must not fail closed on new clients")
    void capacityDoesNotRejectUnrelatedClients() {
        SlidingWindowRateLimiter small = new SlidingWindowRateLimiter(clock, 1);

        assertTrue(small.check("ip:1", 5, 60).allowed());
        // ip:2 cannot be tracked (map full, nothing idle) — the request passes untracked
        // rather than turning the limiter into an outage.
        assertTrue(small.check("ip:2", 5, 60).allowed());
        assertTrue(small.check("ip:2", 5, 60).allowed());
    }
}
