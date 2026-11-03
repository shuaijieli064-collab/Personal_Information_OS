package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.security.UrlValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * "Add a website" is the only collector the user drives by hand, so it has to cope with
 * a homepage, an article page, a feed and a site whose feed lives elsewhere. The
 * original implementation fetched one page and extracted <article> or <body>, which on
 * a portal homepage means the navigation menu — 2 603 characters of 学校概况, scoring
 * 45.8 and never becoming a Signal.
 */
class UrlCollectorTest {

    /** Serves canned pages; anything not registered is a 404, like the real thing. */
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
            <item><title>第一篇文章的标题</title><link>https://example.com/p/1</link>
              <description><![CDATA[<p>这是订阅源里的摘要正文，够写一句话了。</p>]]></description></item>
            <item><title>第二篇文章的标题</title><link>https://example.com/p/2</link>
              <description><![CDATA[<p>第二篇的摘要正文。</p>]]></description></item>
            </channel></rss>
            """;

    /** A listing page: short real text, the rest is navigation, plus article links. */
    private static final String LISTING = """
            <html><head><title>学院首页</title></head><body>
            <nav><a href="/159/list.htm">学校概况</a><a href="/161/list.htm">机构设置</a></nav>
            <ul>
              <li><a href="/2026/1016/c1/page.htm">许昌职业技术学院来校调研交流</a></li>
              <li><a href="/2026/1014/c2/page.htm">学校召开东风校区综合协调联席会</a></li>
            </ul>
            <p>综合要闻 更多</p>
            </body></html>
            """;

    private static final String ARTICLE_BODY_PART =
            ("这次调研围绕产教融合与专业共建展开，双方在实训基地、课程衔接和师资互聘三个方面达成了初步共识，"
                    + "并商定下一阶段各自组建工作专班，逐项对接实施方案与时间表。").repeat(4);

    private FakeFetcher fetcher;
    private UrlCollector collector;

    @BeforeEach
    void setUp() {
        fetcher = new FakeFetcher();
        collector = new UrlCollector(fetcher, new UrlValidator(), new ArticleExtractor(),
                new FeedGateway(fetcher, true), 1200, 10);
    }

    private Source source(String type, String url) {
        Source s = new Source();
        s.setType(type);
        s.setUrl(url);
        s.setName("我加的来源");
        return s;
    }

    @Test
    @DisplayName("a homepage yields the articles it advertises, not its navigation")
    void homepageYieldsItsArticles() throws Exception {
        fetcher.page("https://example.com/", LISTING, "text/html")
                .page("https://example.com/2026/1016/c1/page.htm",
                        "<html><head><title>许昌职业技术学院来校调研交流</title></head><body>"
                                + "<article><p>" + ARTICLE_BODY_PART + "</p></article></body></html>",
                        "text/html")
                .page("https://example.com/2026/1014/c2/page.htm",
                        "<html><head><title>学校召开东风校区综合协调联席会</title></head><body>"
                                + "<article><p>" + ARTICLE_BODY_PART + "</p></article></body></html>",
                        "text/html");

        SourceCollector.CollectResult r = collector.collect(source("URL", "https://example.com/"));

        assertEquals(2, r.items().size());
        assertEquals("许昌职业技术学院来校调研交流", r.items().get(0).title());
        assertTrue(r.items().get(0).content().contains("产教融合"),
                "the article body must be the content, not the page chrome");
        assertFalse(r.items().get(0).content().contains("学校概况"), "nav leaked into content");
    }

    @Test
    @DisplayName("a page that reads like an article is kept as the single item")
    void anArticlePageIsKeptAsIs() throws Exception {
        String longPage = "<html><head><title>一篇长文</title></head><body>"
                + "<article><p>" + ARTICLE_BODY_PART.repeat(12) + "</p></article></body></html>";
        fetcher.page("https://example.com/a/long-article.html", longPage, "text/html");

        SourceCollector.CollectResult r =
                collector.collect(source("URL", "https://example.com/a/long-article.html"));

        assertEquals(1, r.items().size());
        assertEquals("一篇长文", r.items().get(0).title());
        assertTrue(r.items().get(0).content().length() > 1200);
    }

    @Test
    @DisplayName("a URL that is itself a feed is read as a feed")
    void aFeedUrlIsReadAsAFeed() throws Exception {
        fetcher.page("https://example.com/feed.xml", FEED, "application/rss+xml");

        SourceCollector.CollectResult r =
                collector.collect(source("URL", "https://example.com/feed.xml"));

        assertEquals(2, r.items().size());
        assertEquals("第一篇文章的标题", r.items().get(0).title());
        assertNull(r.resolvedUrl());
    }

    @Test
    @DisplayName("a site whose feed is elsewhere is adopted, and the source is rewritten to it")
    void feedElsewhereIsAdopted() throws Exception {
        fetcher.page("https://example.com/", LISTING, "text/html")
                .page("https://example.com/feed", FEED, "application/rss+xml");

        SourceCollector.CollectResult r = collector.collect(source("URL", "https://example.com/"));

        assertEquals(2, r.items().size());
        assertEquals("https://example.com/feed", r.resolvedUrl());
        assertEquals("RSS", r.resolvedType());
    }

    @Test
    @DisplayName("a listing page whose links are all dead still returns the page itself")
    void deadLinksFallBackToThePage() throws Exception {
        fetcher.page("https://example.com/", LISTING, "text/html");

        SourceCollector.CollectResult r = collector.collect(source("URL", "https://example.com/"));

        assertEquals(1, r.items().size());
        assertEquals("学院首页", r.items().get(0).title());
    }

    @Test
    @DisplayName("a URL that is neither a page nor a feed is reported as not found")
    void deadUrlIsReported() throws Exception {
        assertThrows(HttpFetcher.FetchFailedException.class,
                () -> collector.collect(source("URL", "https://example.com/missing")));
    }
}
