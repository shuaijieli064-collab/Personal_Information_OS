package com.signal.ingestion.pipeline;

import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Feed parsing and feed discovery, shared by the URL and RSS collectors.
 *
 * <p>The two failure modes this exists for, both reported as "this URL will not sync":
 * <ul>
 *   <li>a source typed RSS that points at a normal website — Rome throws a parse
 *       error and the user gets "无法同步该来源" with no clue why;</li>
 *   <li>a source typed URL that points at a homepage — previously one page of
 *       navigation chrome, no articles, and re-syncing could never add anything.</li>
 * </ul>
 * Discovery turns either into the other side's success: find the site's feed and
 * read it.
 */
@Component
public class FeedGateway {

    /** One feed item before it becomes a NormalizedItem. */
    public record Entry(String externalId, String title, String text, String excerpt,
                        String url, String author, Instant publishedAt, String type,
                        java.util.Map<String, Object> metadata) {}

    private static final List<String> WELL_KNOWN = List.of(
            "feed", "feed.xml", "rss.xml", "rss", "atom.xml", "index.xml", "feed/",
            "rss/", "atom/", "?feed=rss2", "?feed=rss", "?feed=atom");

    private final HttpFetcher fetcher;
    private final boolean discoverWellKnown;

    public FeedGateway(HttpFetcher fetcher,
                       @Value("${ingestion.discover-well-known:true}") boolean discoverWellKnown) {
        this.fetcher = fetcher;
        this.discoverWellKnown = discoverWellKnown;
    }

    /** XML with a feed root — a cheap check so HTML is not fed to Rome. */
    public boolean looksLikeFeed(byte[] body, String contentType) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String head = new String(body, 0, Math.min(body.length, 1024), StandardCharsets.ISO_8859_1)
                .toLowerCase(Locale.ROOT);
        if (head.contains("<html")) return false;
        return head.contains("<rss") || head.contains("<feed") || head.contains("<rdf")
                || ct.startsWith("application/rss+xml")
                || ct.startsWith("application/atom+xml")
                || (ct.startsWith("application/xml") || ct.startsWith("text/xml"))
                && (head.contains("<rss") || head.contains("<feed") || head.contains("<rdf"));
    }

    /** Rome does the parsing; a non-feed body throws, which callers treat as "not a feed". */
    public List<Entry> parse(byte[] body) throws Exception {
        SyndFeed feed;
        try (XmlReader reader = new XmlReader(new ByteArrayInputStream(body))) {
            feed = new SyndFeedInput().build(reader);
        }
        List<Entry> out = new ArrayList<>();
        for (SyndEntry e : feed.getEntries()) {
            String rawHtml = e.getDescription() != null ? e.getDescription().getValue() : "";
            if (rawHtml.isBlank() && e.getContents() != null && !e.getContents().isEmpty()) {
                rawHtml = e.getContents().get(0).getValue();
            }
            String text = Jsoup.clean(rawHtml, org.jsoup.safety.Safelist.none());
            if (text.isBlank()) text = Jsoup.clean(e.getTitle() == null ? "" : e.getTitle(),
                    org.jsoup.safety.Safelist.none());
            String title = e.getTitle() == null || e.getTitle().isBlank() ? "Untitled" : e.getTitle().trim();
            Instant pub = e.getPublishedDate() != null ? e.getPublishedDate().toInstant()
                    : (e.getUpdatedDate() != null ? e.getUpdatedDate().toInstant() : null);
            String author = e.getAuthor() != null && !e.getAuthor().isBlank() ? e.getAuthor() : null;
            out.add(new Entry(e.getUri() != null ? e.getUri() : e.getLink(), title, text,
                    text.length() > 280 ? text.substring(0, 280) : text,
                    e.getLink(), author, pub, "ARTICLE", null));
        }
        return out;
    }

    /**
     * Find the feed behind an HTML page: {@code <link rel=alternate type=application/rss+xml">}
     * first (what every CMS emits), then a handful of well-known paths, each verified
     * by actually parsing it. Returns null when the site simply has no feed.
     *
     * @param html the page already decoded with its own charset
     */
    public String discover(String pageUrl, String html) {
        Set<String> candidates = new LinkedHashSet<>();
        try {
            Document doc = Jsoup.parse(html, pageUrl);
            URI base = URI.create(pageUrl);
            for (Element link : doc.select("link[rel=alternate][href]")) {
                String type = link.attr("type").toLowerCase(Locale.ROOT);
                if (!type.contains("rss") && !type.contains("atom") && !type.contains("xml")) continue;
                try {
                    candidates.add(base.resolve(link.attr("abs:href")).toString());
                } catch (IllegalArgumentException ignored) { }
            }
            if (discoverWellKnown) {
                String root = base.getScheme() + "://" + base.getAuthority() + "/";
                for (String path : WELL_KNOWN) candidates.add(root + path);
            }
        } catch (Exception e) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate.equals(pageUrl)) continue;
            if (!isFeed(candidate)) continue;
            return candidate;
        }
        return null;
    }

    private boolean isFeed(String url) {
        try {
            HttpFetcher.FetchResult r = fetcher.getResult(url);
            return looksLikeFeed(r.body(), r.contentType());
        } catch (Exception e) {
            return false;
        }
    }

    /** Absolute URL of a path fragment, or null if it cannot be resolved. */
    public static String resolve(String base, String path) {
        try {
            return URI.create(base).resolve(path).toString();
        } catch (Exception e) {
            return null;
        }
    }
}
