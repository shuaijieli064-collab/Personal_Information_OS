package com.signal.ingestion.pipeline;

import com.signal.ingestion.pipeline.CollectFailure.Reason;
import com.signal.ingestion.security.UrlValidator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * A failed sync must carry the reason, not one opaque sentence: 404, a bot wall, a
 * timeout and "that URL is not a feed" all need different fixes from the user.
 */
class CollectFailureTest {

    @Test
    @DisplayName("a 404 is a dead link")
    void notFound() {
        assertEquals(Reason.NOT_FOUND,
                CollectFailure.of(new HttpFetcher.FetchFailedException("HTTP 404")).reason());
    }

    @Test
    @DisplayName("a 403/429 is the site refusing us")
    void rejected() {
        assertEquals(Reason.REJECTED,
                CollectFailure.of(new HttpFetcher.FetchFailedException("HTTP 403")).reason());
        assertEquals(Reason.REJECTED,
                CollectFailure.of(new HttpFetcher.FetchFailedException("HTTP 429 Too Many Requests")).reason());
    }

    @Test
    @DisplayName("a timeout is a timeout, not a network error")
    void timeout() {
        assertEquals(Reason.TIMEOUT, CollectFailure.of(
                new HttpFetcher.FetchFailedException("Fetch failed: request timed out")).reason());
    }

    @Test
    @DisplayName("a reset connection is the network, not the site")
    void network() {
        assertEquals(Reason.NETWORK, CollectFailure.of(
                new HttpFetcher.FetchFailedException("Fetch failed: Connection reset")).reason());
    }

    @Test
    @DisplayName("the SSRF guard's own exception is reported as blocked")
    void blocked() {
        assertEquals(Reason.BLOCKED, CollectFailure.of(
                new UrlValidator.BlockedUrlException("Blocked address: 127.0.0.1")).reason());
    }

    @Test
    @DisplayName("an existing CollectFailure keeps its reason")
    void passthrough() {
        CollectFailure original = new CollectFailure(Reason.NOT_A_FEED, "not a feed");
        assertEquals(Reason.NOT_A_FEED, CollectFailure.of(original).reason());
    }

    @Test
    @DisplayName("a malformed URL is a shape problem, not a security block")
    void malformedUrlIsNotBlocked() {
        assertEquals(Reason.INVALID_URL, CollectFailure.of(
                new UrlValidator.BlockedUrlException("Invalid URL")).reason());
        assertEquals(Reason.INVALID_URL, CollectFailure.of(
                new UrlValidator.BlockedUrlException("URL host is required")).reason());
        assertEquals(Reason.INVALID_URL, CollectFailure.of(
                new HttpFetcher.FetchFailedException("Invalid URL: no scheme")).reason());
    }

    @Test
    @DisplayName("an unclassifiable failure degrades to UNKNOWN, never to a crash")
    void unknown() {
        assertEquals(Reason.UNKNOWN, CollectFailure.of(new IllegalStateException("whatever")).reason());
    }
}
