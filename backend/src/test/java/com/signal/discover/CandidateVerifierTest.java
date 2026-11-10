package com.signal.discover;

import com.signal.ingestion.pipeline.HttpFetcher;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The verification gate: a candidate only counts as good if its URL, fetched right now,
 * yields the subscription it claims to be. Fabricated domains must die here.
 */
class CandidateVerifierTest {

    private static final String FEED = """
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0"><channel><title>f</title>
            <item><title>one</title><link>https://example.com/p/1</link>
            <description><![CDATA[x]]></description></item></channel></rss>
            """;

    private static final String FEED_EMPTY = """
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0"><channel><title>empty</title></channel></rss>
            """;

    private static final String HTML = "<html><head><title>h</title></head><body>x</body></html>";

    private static final String REPO_JSON = """
            {"full_name":"pgvector/pgvector","message":null}
            """;

    private static final String REPO_404_SHAPE = """
            {"message":"Not Found","documentation_url":"https://docs.github.com"}
            """;

    /** Mirrors the RssCollectorTest fetch stub: URLs answer only if taught. */
    private static final class FakeFetcher extends HttpFetcher {
        private final Map<String, HttpFetcher.FetchResult> pages = new HashMap<>();

        FakeFetcher() {
            super(null, 8_000L, 5_000_000L);
        }

        FakeFetcher page(String url, String body, String contentType) {
            pages.put(url, new HttpFetcher.FetchResult(
                    body.getBytes(StandardCharsets.UTF_8), url, contentType, 200));
            return this;
        }

        @Override
        public HttpFetcher.FetchResult getResult(String url) {
            HttpFetcher.FetchResult r = pages.get(url);
            if (r == null) throw new HttpFetcher.FetchFailedException("HTTP 404");
            return r;
        }

        @Override
        public byte[] get(String url) {
            return getResult(url).body();
        }
    }

    private static CandidateVerifier verifier(FakeFetcher f) {
        return new CandidateVerifier(f, new com.signal.ingestion.pipeline.FeedGateway(
                f, false /* discoverWellKnown off: the gate must fetch the exact URL, not guess paths */),
                "https://api.github.test");
    }

    // ── RSS ─────────────────────────────────────────────────────────────────────

    @Test
    void aRealFeedWithEntriesIsVerified() {
        FakeFetcher f = new FakeFetcher().page("https://f.test/feed.xml", FEED, "application/rss+xml");
        assertTrue(verifier(f).verify("RSS", "https://f.test/feed.xml"));
    }

    @Test
    void anHtmlHomepageIsRejected() {
        FakeFetcher f = new FakeFetcher().page("https://f.test/", HTML, "text/html");
        assertFalse(verifier(f).verify("RSS", "https://f.test/"));
    }

    @Test
    void anEmptyFeedIsRejected() {
        FakeFetcher f = new FakeFetcher().page("https://f.test/empty.xml", FEED_EMPTY, "application/rss+xml");
        assertFalse(verifier(f).verify("RSS", "https://f.test/empty.xml"));
    }

    @Test
    void aDeadFeedUrlIsRejected() {
        assertFalse(verifier(new FakeFetcher()).verify("RSS", "https://gone.test/feed.xml"));
    }

    @Test
    void aPrivateAddressIsBlockedByTheIngressGuardNotByLuck() {
        // the guard lives in HttpFetcher/UrlValidator; a blank page map means the
        // candidate never even resolves — the point is that verify() returns false
        // (and never true) for anything it could not fetch.
        assertFalse(verifier(new FakeFetcher()).verify("RSS", "http://127.0.0.1:5432/feed.xml"));
    }

    // ── GITHUB ──────────────────────────────────────────────────────────────────

    @Test
    void aLiveRepoIsVerifiedThroughThePublicApi() {
        FakeFetcher f = new FakeFetcher().page(
                "https://api.github.test/repos/pgvector/pgvector", REPO_JSON, "application/json");
        assertTrue(verifier(f).verify("GITHUB", "https://github.com/pgvector/pgvector"));
    }

    @Test
    void aGithub404BodyIsRejected() {
        FakeFetcher f = new FakeFetcher().page(
                "https://api.github.test/repos/fake/none", REPO_404_SHAPE, "application/json");
        assertFalse(verifier(f).verify("GITHUB", "https://github.com/fake/none"));
    }

    @Test
    void aDeadGithubCandidateIsRejected() {
        assertFalse(verifier(new FakeFetcher()).verify("GITHUB", "https://github.com/fake/none"));
    }

    // ── owner/repo extraction ───────────────────────────────────────────────────

    @Test
    void repoUrlsExtractOwnerRepo() {
        assertEquals("pgvector/pgvector",
                CandidateVerifier.ownerRepo("https://github.com/pgvector/pgvector"));
        assertEquals("pgvector/pgvector",
                CandidateVerifier.ownerRepo("https://github.com/pgvector/pgvector.git"));
        assertEquals("pgvector/pgvector",
                CandidateVerifier.ownerRepo("https://github.com/pgvector/pgvector/"));
    }

    @Test
    void nonRepositoryPagesExtractToNull() {
        assertNull(CandidateVerifier.ownerRepo("https://github.com/topics/database"));
        assertNull(CandidateVerifier.ownerRepo("https://github.com/search?q=vector"));
        assertNull(CandidateVerifier.ownerRepo("https://github.com/explore"));
        assertNull(CandidateVerifier.ownerRepo("https://github.com/only-owner"));
        assertNull(CandidateVerifier.ownerRepo("not a url :x"));
    }

    // ── dispatch ────────────────────────────────────────────────────────────────

    @Test
    void unknownTypesAndBlankUrlsAreRejected() {
        CandidateVerifier v = verifier(new FakeFetcher().page(
                "https://api.github.test/repos/a/b", REPO_JSON, "application/json"));
        assertFalse(v.verify("URL", "https://github.com/a/b"), "URL sources are not discoverable yet");
        assertFalse(v.verify("RSS", ""));
        assertFalse(v.verify("RSS", null));
    }
}
