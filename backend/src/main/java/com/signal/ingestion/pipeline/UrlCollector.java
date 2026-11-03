package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.security.UrlValidator;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * "Add a website" — the only collector the user drives by hand, so it has to cope
 * with whatever URL they paste.
 *
 * <p>Previously it fetched exactly one page and extracted {@code <article>} or the
 * whole {@code <body>}. For a homepage that means navigation chrome and nothing else:
 * the real import of a university site was 2 603 characters, most of them the words
 * 导航 / 学校概况 / 机构设置, which then scored 45.8/100 and never became a Signal.
 * Re-syncing could not help, because the page never changes.
 *
 * <p>Now, in order:
 * <ol>
 *   <li>if the URL is itself a feed, read it;</li>
 *   <li>otherwise try to find the site's feed ({@code rel=alternate} then well-known
 *       paths) and adopt it — the source is rewritten to point at the feed, so the
 *       next sync is a normal RSS sync;</li>
 *   <li>otherwise treat the page as a listing: harvest article-shaped links and fetch
 *       each one, so a homepage yields the articles it advertises rather than its
 *       own chrome;</li>
 *   <li>if the page reads like an article already (long prose) or the harvest comes
 *       back empty, keep the page itself as the single item.</li>
 * </ol>
 */
@Component
public class UrlCollector implements SourceCollector {

    /** Below this much prose the page is treated as a listing, not an article. */
    private final int minArticleChars;
    private final int maxPages;

    private final HttpFetcher fetcher;
    private final UrlValidator validator;
    private final ArticleExtractor extractor;
    private final FeedGateway feeds;

    public UrlCollector(HttpFetcher fetcher,
                        UrlValidator validator,
                        ArticleExtractor extractor,
                        FeedGateway feeds,
                        @Value("${ingestion.site.min-article-chars:1200}") int minArticleChars,
                        @Value("${ingestion.site.max-pages:10}") int maxPages) {
        this.fetcher = fetcher;
        this.validator = validator;
        this.extractor = extractor;
        this.feeds = feeds;
        this.minArticleChars = minArticleChars;
        this.maxPages = Math.max(1, maxPages);
    }

    @Override public boolean supports(String type) { return "URL".equalsIgnoreCase(type); }

    @Override
    public CollectResult collect(Source source) throws Exception {
        validator.validate(source.getUrl());
        HttpFetcher.FetchResult fetched = fetcher.getResult(source.getUrl());
        String url = fetched.finalUrl();
        byte[] body = fetched.body();
        String ct = fetched.contentType();

        // 1 · the URL the user pasted is a feed already
        if (feeds.looksLikeFeed(body, ct)) {
            return CollectResult.of(toItems(feeds.parse(body)));
        }

        String html = extractor.decode(body, ct);
        Document doc = Jsoup.parse(html, url);

        // 2 · the site publishes a feed elsewhere
        String feedUrl = feeds.discover(url, html);
        if (feedUrl != null) {
            try {
                List<NormalizedItem> items = toItems(feeds.parse(fetcher.getResult(feedUrl).body()));
                if (!items.isEmpty()) {
                    return CollectResult.resolved(items, feedUrl, "RSS");
                }
            } catch (Exception e) {
                // fall through to the listing crawl: a feed that will not parse is
                // the same as no feed at all.
            }
        }

        ArticleExtractor.Article page = extractor.extract(body, ct, url);

        // 3 · a listing page: follow the articles it advertises. Two signals say
        // "listing": the page has little prose of its own, or what prose it has is
        // mostly link labels. Either way, its own text is chrome, not content.
        boolean listing = page.text().length() < minArticleChars || extractor.isListingPage(doc);
        List<String> links = listing ? extractor.articleLinks(doc, safe(url), maxPages) : List.of();
        List<NormalizedItem> crawled = new ArrayList<>();
        for (String link : links) {
            try {
                HttpFetcher.FetchResult r = fetcher.getResult(link);
                ArticleExtractor.Article a = extractor.extract(r.body(), r.contentType(), link);
                if (a.text().length() < 120) continue; // paywall shell / JS-only page
                crawled.add(toItem(a, link, null));
            } catch (Exception e) {
                // one dead link must not cost the other nine
            }
        }
        if (!crawled.isEmpty()) return CollectResult.of(crawled);

        // 4 · the page is the content
        return CollectResult.of(List.of(toItem(page, url, doc)));
    }

    private NormalizedItem toItem(ArticleExtractor.Article a, String url, Document doc) {
        Map<String, Object> meta = new HashMap<>();
        if (doc != null) {
            String og = doc.selectFirst("meta[property=og:image]") == null ? null
                    : doc.selectFirst("meta[property=og:image]").attr("content");
            if (og != null && !og.isBlank()) meta.put("image", og);
        }
        return new NormalizedItem(
                com.signal.ingestion.pipeline.Hashing.canonicalUrl(url), a.title(), a.text(), a.excerpt(),
                url, null, null, "ARTICLE", null, meta);
    }

    private List<NormalizedItem> toItems(List<FeedGateway.Entry> entries) {
        List<NormalizedItem> out = new ArrayList<>();
        for (FeedGateway.Entry e : entries) {
            String url = e.url() != null ? e.url() : e.externalId();
            out.add(new NormalizedItem(
                    e.externalId() != null ? e.externalId() : com.signal.ingestion.pipeline.Hashing.canonicalUrl(url),
                    e.title(), e.text(), e.excerpt(), url, e.author(), e.publishedAt(),
                    e.type(), null, e.metadata() == null ? Map.of() : e.metadata()));
        }
        return out;
    }

    private static URI safe(String url) {
        try {
            return URI.create(url);
        } catch (IllegalArgumentException e) {
            try {
                return new URI(url);
            } catch (URISyntaxException ex) {
                return null;
            }
        }
    }
}
