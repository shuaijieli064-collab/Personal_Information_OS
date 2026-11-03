package com.signal.security.ratelimit;

import com.signal.common.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.util.List;

/**
 * Rejects credential-endpoint floods with 429 before any controller work happens.
 *
 * <p>Ordered after the security chain so a throttled request still passes the cheap
 * filters and only skips the expensive work (BCrypt, provider calls).
 *
 * <p>The 429 body speaks the same {@code {success, error:{code,message}}} envelope as
 * every other failure, and carries {@code Retry-After}, so a client can wait instead of
 * retrying blindly.
 *
 * <p>The rejection also writes the CORS headers itself. The app configures CORS on the
 * MVC layer ({@code CorsConfig}), and that layer only runs inside {@code DispatcherServlet}
 * — a response short-circuited in a filter would reach the browser without
 * {@code Access-Control-Allow-Origin}, so the client would see a network error instead of
 * {@code RATE_LIMITED} and could not explain the wait to the user.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    /** Error code the frontend maps to a localized "slow down" message. */
    public static final String RATE_LIMITED = "RATE_LIMITED";

    private final SlidingWindowRateLimiter limiter;
    private final boolean trustForwardedFor;
    private final List<RateLimitProperties.Rule> rules;
    private final String allowedOrigin;
    private final ObjectMapper json = new ObjectMapper();

    /**
     * Reads its own configuration rather than injecting a properties bean: {@code @WebMvcTest}
     * slices instantiate servlet filters but do not run {@code @ConfigurationPropertiesScan},
     * so a bean dependency here would make every slice with this filter unstartable.
     */
    @Autowired
    public RateLimitFilter(
            @Value("${app.security.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.security.rate-limit.login-per-minute:10}") int loginPerMinute,
            @Value("${app.security.rate-limit.register-per-hour:30}") int registerPerHour,
            @Value("${app.security.rate-limit.refresh-per-minute:30}") int refreshPerMinute,
            @Value("${app.security.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor,
            @Value("${app.security.rate-limit.max-tracked-keys:20000}") int maxTrackedKeys,
            @Value("${signal.cors.allowed-origin:http://localhost:3000}") String allowedOrigin) {
        this(settings(enabled, loginPerMinute, registerPerHour, refreshPerMinute,
                        trustForwardedFor, maxTrackedKeys),
                new SlidingWindowRateLimiter(Clock.systemUTC(), maxTrackedKeys),
                allowedOrigin);
    }

    /** Seam for tests: explicit settings, a controllable clock and a known origin. */
    RateLimitFilter(RateLimitProperties props, SlidingWindowRateLimiter limiter, String allowedOrigin) {
        this.limiter = limiter;
        this.trustForwardedFor = props.isTrustForwardedFor();
        this.rules = props.isEnabled() ? props.rules() : List.of();
        this.allowedOrigin = allowedOrigin;
    }

    private static RateLimitProperties settings(boolean enabled, int loginPerMinute, int registerPerHour,
                                                int refreshPerMinute, boolean trustForwardedFor,
                                                int maxTrackedKeys) {
        RateLimitProperties props = new RateLimitProperties();
        props.setEnabled(enabled);
        props.setLoginPerMinute(loginPerMinute);
        props.setRegisterPerHour(registerPerHour);
        props.setRefreshPerMinute(refreshPerMinute);
        props.setTrustForwardedFor(trustForwardedFor);
        props.setMaxTrackedKeys(maxTrackedKeys);
        return props;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {
        RateLimitProperties.Rule rule = ruleFor(request);
        if (rule == null) {
            chain.doFilter(request, response);
            return;
        }

        SlidingWindowRateLimiter.Decision decision =
                limiter.check(clientKey(request, rule), rule.limit(), rule.windowSeconds());

        if (decision.allowed()) {
            if (rule.limit() > 0) {
                response.setHeader("X-RateLimit-Limit", String.valueOf(rule.limit()));
                response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));
            }
            chain.doFilter(request, response);
            return;
        }

        response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
        response.setHeader("X-RateLimit-Limit", String.valueOf(rule.limit()));
        response.setHeader("X-RateLimit-Remaining", "0");
        writeCorsHeaders(response);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(json.writeValueAsString(ApiResponse.fail(RATE_LIMITED,
                "Too many requests. Try again in " + decision.retryAfterSeconds() + "s.")));
    }

    /**
     * Echo the configured origin, never the request's: a foreign origin learns nothing,
     * and the real client can still read the body. Mirrors {@code CorsConfig}.
     */
    private void writeCorsHeaders(HttpServletResponse response) {
        if (allowedOrigin == null || allowedOrigin.isBlank()) return;
        response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Vary", "Origin");
    }

    /** Matching rule for this request, or null when the path is not limited. */
    private RateLimitProperties.Rule ruleFor(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path == null) return null;
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && path.startsWith(context)) {
            path = path.substring(context.length());
        }
        for (RateLimitProperties.Rule rule : rules) {
            // Method matters: a GET on an auth path is not a credential attempt.
            if (rule.path().equals(path) && "POST".equalsIgnoreCase(request.getMethod())) {
                return rule;
            }
        }
        return null;
    }

    /**
     * Identity a rule counts against. The socket address is the only unspoofable value,
     * so {@code X-Forwarded-For} is read only when the deployment declares a trusted proxy.
     */
    private String clientKey(HttpServletRequest request, RateLimitProperties.Rule rule) {
        String address = trustForwardedFor ? firstForwardedFor(request) : null;
        if (address == null || address.isBlank()) address = request.getRemoteAddr();
        if (address == null || address.isBlank()) address = "unknown";
        return rule.name() + ":" + address;
    }

    private String firstForwardedFor(HttpServletRequest request) {
        String header = request.getHeader("X-Forwarded-For");
        if (header == null || header.isBlank()) return null;
        int comma = header.indexOf(',');
        return (comma < 0 ? header : header.substring(0, comma)).trim();
    }
}
