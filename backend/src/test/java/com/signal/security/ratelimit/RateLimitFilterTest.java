package com.signal.security.ratelimit;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class RateLimitFilterTest {

    private static RateLimitProperties props(int loginPerMinute) {
        RateLimitProperties props = new RateLimitProperties();
        props.setLoginPerMinute(loginPerMinute);
        props.setRegisterPerHour(loginPerMinute);
        props.setRefreshPerMinute(loginPerMinute);
        props.setMaxTrackedKeys(1000);
        return props;
    }

    private static RateLimitFilter filter(RateLimitProperties props) {
        return new RateLimitFilter(props, new SlidingWindowRateLimiter(Clock.systemUTC(), 1000),
                "http://localhost:3000");
    }

    private static MockHttpServletRequest request(String method, String path, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    @Test
    @DisplayName("the (limit+1)th login from one address gets 429 with Retry-After")
    void loginIsThrottled() throws Exception {
        RateLimitFilter filter = filter(props(2));
        AtomicInteger reached = new AtomicInteger();
        FilterChain chain = (req, res) -> reached.incrementAndGet();

        for (int i = 0; i < 2; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"), response, chain);
            assertEquals(200, response.getStatus());
        }

        MockHttpServletResponse denied = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"), denied, chain);

        assertEquals(429, denied.getStatus());
        assertEquals("60", denied.getHeader("Retry-After"));
        assertEquals("2", denied.getHeader("X-RateLimit-Limit"));
        assertEquals("0", denied.getHeader("X-RateLimit-Remaining"));
        assertTrue(denied.getContentType() != null && denied.getContentType().startsWith("application/json"));
        assertTrue(denied.getContentAsString().contains("\"success\":false"));
        assertTrue(denied.getContentAsString().contains(RateLimitFilter.RATE_LIMITED));
        assertEquals(2, reached.get(), "a throttled request must never reach the controller");
    }

    @Test
    @DisplayName("the 429 carries CORS headers, or the browser would only see a network error")
    void rejectionIsReadableCrossOrigin() throws Exception {
        RateLimitFilter filter = filter(props(1));
        FilterChain chain = (req, res) -> {
        };

        filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"),
                new MockHttpServletResponse(), chain);
        MockHttpServletRequest second = request("POST", "/api/v1/auth/login", "10.0.0.1");
        second.addHeader("Origin", "http://localhost:3000");
        MockHttpServletResponse denied = new MockHttpServletResponse();
        filter.doFilter(second, denied, chain);

        assertEquals(429, denied.getStatus());
        assertEquals("http://localhost:3000", denied.getHeader("Access-Control-Allow-Origin"));
        assertEquals("true", denied.getHeader("Access-Control-Allow-Credentials"));
        assertEquals("Origin", denied.getHeader("Vary"));
    }

    @Test
    @DisplayName("allowed requests advertise what is left")
    void allowedRequestsCarryHeaders() throws Exception {
        RateLimitFilter filter = filter(props(3));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"), response, (req, res) -> {
        });

        assertEquals("3", response.getHeader("X-RateLimit-Limit"));
        assertEquals("2", response.getHeader("X-RateLimit-Remaining"));
        assertNull(response.getHeader("Retry-After"));
    }

    @Test
    @DisplayName("paths outside the rules are untouched")
    void otherPathsAreNotLimited() throws Exception {
        RateLimitFilter filter = filter(props(1));
        AtomicInteger reached = new AtomicInteger();
        FilterChain chain = (req, res) -> reached.incrementAndGet();

        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request("POST", "/api/v1/information", "10.0.0.1"), response, chain);
            assertEquals(200, response.getStatus());
        }

        assertEquals(10, reached.get());
    }

    @Test
    @DisplayName("a GET on an auth path is not a credential attempt")
    void nonPostMethodsAreNotLimited() throws Exception {
        RateLimitFilter filter = filter(props(1));
        AtomicInteger reached = new AtomicInteger();
        FilterChain chain = (req, res) -> reached.incrementAndGet();

        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request("GET", "/api/v1/auth/login", "10.0.0.1"), response, chain);
        }

        assertEquals(5, reached.get());
    }

    @Test
    @DisplayName("each rule keeps its own budget")
    void rulesHaveSeparateBudgets() throws Exception {
        RateLimitFilter filter = filter(props(1));
        FilterChain chain = (req, res) -> {
        };

        MockHttpServletResponse login = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"), login, chain);

        // The login budget is spent; register from the same address is still allowed.
        MockHttpServletResponse register = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/auth/register", "10.0.0.1"), register, chain);

        assertEquals(200, register.getStatus());
    }

    @Test
    @DisplayName("X-Forwarded-For is ignored unless a trusted proxy is declared")
    void forwardedForIsIgnoredByDefault() throws Exception {
        RateLimitFilter filter = filter(props(1));
        FilterChain chain = (req, res) -> {
        };

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"), first, chain);

        // Same socket address, a fresh spoofed header: still throttled.
        MockHttpServletRequest spoofed = request("POST", "/api/v1/auth/login", "10.0.0.1");
        spoofed.addHeader("X-Forwarded-For", "203.0.113.9");
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(spoofed, second, chain);

        assertEquals(429, second.getStatus());
    }

    @Test
    @DisplayName("behind a declared proxy the forwarded client address is what counts")
    void forwardedForIsHonouredWhenTrusted() throws Exception {
        RateLimitProperties props = props(1);
        props.setTrustForwardedFor(true);
        RateLimitFilter filter = filter(props);
        FilterChain chain = (req, res) -> {
        };

        MockHttpServletRequest one = request("POST", "/api/v1/auth/login", "10.0.0.1");
        one.addHeader("X-Forwarded-For", "203.0.113.9");
        filter.doFilter(one, new MockHttpServletResponse(), chain);

        // Same proxy hop, different real client — a separate budget.
        MockHttpServletRequest two = request("POST", "/api/v1/auth/login", "10.0.0.1");
        two.addHeader("X-Forwarded-For", "203.0.113.10, 10.0.0.1");
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(two, second, chain);

        assertEquals(200, second.getStatus());
    }

    @Test
    @DisplayName("disabled means disabled")
    void disabledFilterPassesEverything() throws Exception {
        RateLimitProperties props = props(1);
        props.setEnabled(false);
        RateLimitFilter filter = filter(props);
        AtomicInteger reached = new AtomicInteger();

        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request("POST", "/api/v1/auth/login", "10.0.0.1"), response,
                    (req, res) -> reached.incrementAndGet());
        }

        assertEquals(10, reached.get());
    }
}
