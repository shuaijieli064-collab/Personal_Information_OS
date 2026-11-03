package com.signal.security.ratelimit;

import java.util.List;

/**
 * Rate-limit settings for the credential endpoints.
 *
 * <p>Deliberately a plain value object rather than a {@code @ConfigurationProperties}
 * bean: {@code RateLimitFilter} is a servlet {@code Filter}, so {@code @WebMvcTest}
 * slices instantiate it, and a slice does not run {@code @ConfigurationPropertiesScan}.
 * Reading the values inside the filter keeps every slice that loads it startable.
 *
 * <p>Defaults live here as well as in {@code application.properties}: a deployment that
 * forgets to copy a key must not silently lose its brute-force guard. A limit of 0 turns
 * that single rule off — the same convention the pipeline caps already use
 * ({@code app.pipeline.auto-understand-limit}).
 *
 * <p>Limits are per client address, not per account: the filter runs before the request
 * body is read, so it cannot key on the submitted email without buffering the body.
 * Account-targeted lockout is a separate concern (see docs/OPTIMIZATION_REVIEW.md).
 */
public class RateLimitProperties {

    /** Master switch. False leaves every endpoint unlimited (useful for load tests). */
    private boolean enabled = true;

    /** POST /api/v1/auth/login — per client address. */
    private int loginPerMinute = 10;

    /**
     * POST /api/v1/auth/register — per client address, per hour. Deliberately looser
     * than login: registration is not an enumeration oracle, and a shared NAT
     * (office, campus) must still be able to sign up new users.
     */
    private int registerPerHour = 30;

    /** POST /api/v1/auth/refresh — per client address. */
    private int refreshPerMinute = 30;

    /**
     * Read the first {@code X-Forwarded-For} entry instead of the socket address.
     * Only enable behind a proxy you control: the header is client-controlled
     * otherwise, and every request could claim a fresh identity.
     */
    private boolean trustForwardedFor = false;

    /** Hard bound on tracked keys, so the window map cannot grow without limit. */
    private int maxTrackedKeys = 20_000;

    /** Rules the filter enforces, in evaluation order. */
    public List<Rule> rules() {
        return List.of(
                new Rule("login", "/api/v1/auth/login", loginPerMinute, 60),
                new Rule("register", "/api/v1/auth/register", registerPerHour, 3600),
                new Rule("refresh", "/api/v1/auth/refresh", refreshPerMinute, 60));
    }

    /** One limited endpoint: how many requests per client per {@code windowSeconds}. */
    public record Rule(String name, String path, int limit, long windowSeconds) {
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getLoginPerMinute() {
        return loginPerMinute;
    }

    public void setLoginPerMinute(int loginPerMinute) {
        this.loginPerMinute = loginPerMinute;
    }

    public int getRegisterPerHour() {
        return registerPerHour;
    }

    public void setRegisterPerHour(int registerPerHour) {
        this.registerPerHour = registerPerHour;
    }

    public int getRefreshPerMinute() {
        return refreshPerMinute;
    }

    public void setRefreshPerMinute(int refreshPerMinute) {
        this.refreshPerMinute = refreshPerMinute;
    }

    public boolean isTrustForwardedFor() {
        return trustForwardedFor;
    }

    public void setTrustForwardedFor(boolean trustForwardedFor) {
        this.trustForwardedFor = trustForwardedFor;
    }

    public int getMaxTrackedKeys() {
        return maxTrackedKeys;
    }

    public void setMaxTrackedKeys(int maxTrackedKeys) {
        this.maxTrackedKeys = maxTrackedKeys;
    }
}
