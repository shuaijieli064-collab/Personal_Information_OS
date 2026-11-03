package com.signal.ingestion.pipeline;

import java.util.Locale;

/**
 * A collection failure the user can act on.
 *
 * <p>Before this existed every problem — 404, 403, a timeout, a URL that is not a
 * feed at all — became the single string "Unable to synchronize source.", and the
 * UI showed 「无法同步该来源。」 with nothing to fix. The reason travels with the
 * exception so the client can say what actually happened.
 */
public class CollectFailure extends RuntimeException {

    public enum Reason {
        /** The site answered 404/410. */
        NOT_FOUND,
        /** The site refused us: 403/429/401, or a bot wall. */
        REJECTED,
        /** No answer within the timeout. */
        TIMEOUT,
        /** The body could not be parsed as the expected format. */
        PARSE,
        /** An RSS source whose URL is an ordinary web page. */
        NOT_A_FEED,
        /** The URL itself is unusable — no scheme, no host, unparseable. */
        INVALID_URL,
        /** DNS, TLS, connection reset — the network, not the site. */
        NETWORK,
        /** Blocked by the SSRF guard (private/loopback/metadata target). */
        BLOCKED,
        UNKNOWN
    }

    private final Reason reason;

    public CollectFailure(Reason reason, String detail) {
        super(detail);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }

    /** Classify a throwable from the fetch/parse path into a user-facing reason. */
    public static CollectFailure of(Throwable e) {
        if (e instanceof CollectFailure cf) return cf;
        String m = (e == null || e.getMessage() == null) ? "" : e.getMessage().toLowerCase(Locale.ROOT);
        if (e instanceof com.signal.ingestion.security.UrlValidator.BlockedUrlException) {
            // The validator's exceptions are not all blocks: "Invalid URL" and
            // "URL host is required" are shape problems, and reporting them as
            // security blocks sends the user hunting for a setting that has
            // nothing to do with the paste.
            boolean blocked = m.startsWith("blocked");
            return new CollectFailure(blocked ? Reason.BLOCKED : Reason.INVALID_URL, e.getMessage());
        }
        if (m.contains("invalid url")) return new CollectFailure(Reason.INVALID_URL, e.getMessage());
        if (m.startsWith("http 404") || m.startsWith("http 410")) {
            return new CollectFailure(Reason.NOT_FOUND, clean(e));
        }
        if (m.startsWith("http 401") || m.startsWith("http 403")
                || m.startsWith("http 429") || m.startsWith("http 402")) {
            return new CollectFailure(Reason.REJECTED, clean(e));
        }
        if (m.contains("timed out") || m.contains("timeout") || m.contains("etimedout")) {
            return new CollectFailure(Reason.TIMEOUT, clean(e));
        }
        if (e instanceof HttpFetcher.FetchFailedException
                || e instanceof HttpFetcher.PayloadTooLargeException) {
            return new CollectFailure(Reason.NETWORK, clean(e));
        }
        if (m.contains("parse") || m.contains("malformed") || m.contains("invalid xml")
                || m.contains("not a feed") || m.contains("xml")) {
            return new CollectFailure(Reason.PARSE, clean(e));
        }
        return new CollectFailure(Reason.UNKNOWN, clean(e));
    }

    private static String clean(Throwable e) {
        String m = e.getMessage();
        return (m == null || m.isBlank()) ? e.getClass().getSimpleName() : m;
    }
}
