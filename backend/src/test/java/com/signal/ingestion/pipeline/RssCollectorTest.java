package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.security.UrlValidator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * An RSS collector that only reads feed summaries gives the pipeline one sentence to
 * score. Two cases matter here: the URL is not a feed at all (must fail with a reason
 * the user can act on), and the entries are teasers (must be fetched in full).
 */
class RssCollectorTest {

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
    }

    private static final String FEED = """
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0"><channel><title>测试订阅源</title>
            <link>https://example.com</link>
            <item><title>一篇只有摘要的文章</title><link>https://example.com/p/1</link>
              <description><![CDATA[一句话摘要。</p>]]></description></item>
            <item><title>摘要已经足够长的文章标题</title><link>https://example.com/p/2</link>
              <description><![CDATA[%s</p>]]></description></item>
            </channel></rss>
            """.formatted("摘要".repeat(200));

    private static final String FULL_PAGE = """
            <html><head><title>一篇只有摘要的文章</title></head><body>
            <nav>导航 首页 栏目</nav>
            <article><p>%s</p></article></body></html>
            """.formatted("正文".repeat(300));

    private FakeFetcher fetcher;
    private RssCollector collector;

    private void setUp(int minFullText, int fullTextMax) {
        fetcher = new FakeFetcher();
        collector = new RssCollector(fetcher, new ArticleExtractor(), new FeedGateway(fetcher, true),
                minFullText, fullTextMax);
    }

    private Source source(String url) {
        Source s = new Source();
        s.setType("RSS");
        s.setUrl(url);
        s.setName("我的订阅源");
        return s;
    }

    @Test
    @DisplayName("a teaser entry is fetched and replaced by the real article body")
    void teaserEntriesAreFetchedInFull() throws Exception {
        setUp(400, 8);
        fetcher.page("https://example.com/feed.xml", FEED, "application/rss+xml")
                .page("https://example.com/p/1", FULL_PAGE, "text/html");

        SourceCollector.CollectResult r = collector.collect(source("https://example.com/feed.xml"));

        assertEquals(2, r.items().size());
        assertTrue(r.items().get(0).content().contains("正文"),
                "the fetched article body must replace the one-line teaser");
        assertTrue(r.items().get(0).content().length() > 400);
    }

    @Test
    @DisplayName("a long entry is not fetched again — the feed already had it")
    void longEntriesAreNotRefetched() throws Exception {
        setUp(400, 8);
        fetcher.page("https://example.com/feed.xml", FEED, "application/rss+xml");

        SourceCollector.CollectResult r = collector.collect(source("https://example.com/feed.xml"));

        assertEquals(2, r.items().size());
        assertEquals("摘要".repeat(200), r.items().get(1).content());
    }

    @Test
    @DisplayName("full-text enrichment is capped, so a 200-entry feed cannot stall a sync")
    void enrichmentIsCapped() throws Exception {
        setUp(400, 1);
        StringBuilder items = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            // formatted() must cover the whole item, not just the last literal —
            // a "%d" left in the link makes every fetch 404.
            items.append(("""
                    <item><title>文章 %d</title><link>https://example.com/p/%d</link>
                      <description><![CDATA[摘要。</p>]]></description></item>
                    """).formatted(i, i));
        }
        fetcher.page("https://example.com/feed.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel>"
                        + "<title>t</title><link>https://example.com</link>" + items
                        + "</channel></rss>",
                "application/rss+xml")
                .page("https://example.com/p/0", FULL_PAGE, "text/html");

        SourceCollector.CollectResult r = collector.collect(source("https://example.com/feed.xml"));

        assertEquals(5, r.items().size());
        assertEquals(1, r.items().stream().filter(i -> i.content().contains("正文")).count(),
                "only the first entry gets the full text when the cap is 1");
    }

    @Test
    @DisplayName("a teaser whose link is dead keeps the teaser instead of failing the sync")
    void deadTeaserLinkDoesNotFailTheSync() throws Exception {
        setUp(400, 8);
        fetcher.page("https://example.com/feed.xml", FEED, "application/rss+xml");

        SourceCollector.CollectResult r = collector.collect(source("https://example.com/feed.xml"));

        assertEquals(2, r.items().size());
        assertEquals("一句话摘要。", r.items().get(0).content());
    }

    @Test
    @DisplayName("an RSS source pointing at a web page says so, with a reason code")
    void webPageIsNotAFeed() throws Exception {
        setUp(400, 8);
        fetcher.page("https://example.com/", "<html><body><p>普通网页</p></body></html>", "text/html");

        CollectFailure e = assertThrows(CollectFailure.class,
                () -> collector.collect(source("https://example.com/")));

        assertEquals(CollectFailure.Reason.NOT_A_FEED, e.reason());
        assertTrue(e.getMessage().contains("not an RSS/Atom feed"));
    }

    @Test
    @DisplayName("an RSS source pointing at a site with a discoverable feed follows it")
    void siteWithAFeedIsFollowed() throws Exception {
        setUp(400, 8);
        fetcher.page("https://example.com/blog/",
                        "<html><head><link rel=\"alternate\" type=\"application/rss+xml\" "
                                + "href=\"https://example.com/blog/feed.xml\"></head>"
                                + "<body><p>博客首页</p></body></html>",
                        "text/html")
                .page("https://example.com/blog/feed.xml", FEED, "application/rss+xml");

        SourceCollector.CollectResult r = collector.collect(source("https://example.com/blog/"));

        assertEquals(2, r.items().size());
        assertEquals("https://example.com/blog/feed.xml", r.resolvedUrl());
        assertEquals("RSS", r.resolvedType());
    }

    @Test
    @DisplayName("a 404 on the feed itself is still reported as the reason it is")
    void missingFeedIsReported() throws Exception {
        setUp(400, 8);
        HttpFetcher.FetchFailedException e = assertThrows(HttpFetcher.FetchFailedException.class,
                () -> collector.collect(source("https://example.com/nope.xml")));
        assertEquals("HTTP 404", e.getMessage());
    }
}
