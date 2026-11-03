package com.signal.ingestion.pipeline;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.Charset;
import java.nio.charset.IllegalCharsetNameException;
import java.nio.charset.StandardCharsets;
import java.nio.charset.UnsupportedCharsetException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Turns a fetched HTML page into readable text, and finds the articles a listing
 * page links to.
 *
 * <p>Three defects this replaces, all of them reported as "the content is
 * almost empty" / "the page is garbage":
 * <ul>
 *   <li>a hardcoded {@code new String(body, UTF_8)} — a GBK page became mojibake;</li>
 *   <li>{@code selectFirst("article")} + {@code body} fallback — a campus/news portal
 *       homepage has no {@code <article>}, so the extracted "content" was the whole
 *       navigation menu (the real body of a zzuli.edu.cn import was 2 603 chars, most of
 *       it the words 导航 / 学校概况 / 机构设置);</li>
 *   <li>no discovery of what the page links to — adding a website meant one page of
 *       chrome and nothing else, forever.</li>
 * </ul>
 */
@Component
public class ArticleExtractor {

    /** A page turned into something the pipeline can score. */
    public record Article(String title, String text, String excerpt) {}

    private static final int EXCERPT = 280;

    /** Containers that hold an article, most specific first. */
    private static final String[] CONTENT_SELECTORS = {
            "article", "main", "[role=main]", "#content", ".content", ".article",
            ".article-content", ".post-content", ".entry-content", ".detail",
            ".news-content", ".news_content", ".content-text", ".articleBody",
    };

    /**
     * The share of a page's text that sits inside anchors. A portal homepage is
     * ~70% link labels (导航 / 学校概况 / every headline); an article page is ~15%.
     * This is the discriminator between "this page lists things" and "this page IS
     * the thing", and it replaced a pure length check that misread a 2 200-character
     * homepage of headlines as an article.
     */
    private static final double LISTING_ANCHOR_RATIO = 0.45;

    /** Chrome that is never the answer, stripped before a body-text fallback. */
    private static final String NOISE = "nav, header, footer, aside, script, style, noscript, "
            + "form, svg, iframe, template, .nav, .menu, .header, .footer, .sidebar, "
            + ".breadcrumb, .pagination";

    private static final Pattern DATE_IN_PATH =
            Pattern.compile("/\\d{4}[/_-]\\d{1,2}[/_-]\\d{1,2}/|/\\d{4}/\\d{1,4}/|"
                    + "/\\d{8}/|/archive/\\d{4}/\\d{2}/");
    /** Word-shaped article paths — no bare "/p/" or "/a/", which match half the web. */
    private static final Pattern ARTICLE_IN_PATH = Pattern.compile(
            "(/|^)(article|articles|news|info|content|post|posts|detail|story|read|view|show)"
                    + "[-_/]|/c\\d+a\\d+/|/index_\\d+|[\\w-]+\\.s?html?$|[\\w-]+\\.(php|jsp|aspx?)$");
    /**
     * Channel and index pages wear the same ".htm" ending an article does, and every
     * university portal routes its navigation through them. Crawling them produces a
     * list of links, which is exactly the "content is almost nothing" complaint again.
     */
    private static final Pattern LISTING_FILENAME = Pattern.compile(
            "(^|/)(list|index|default|channel|column|category|tag|more|search|login)\\.(s?html?|php|jsp|aspx?)$",
            Pattern.CASE_INSENSITIVE);

    // ── charset ───────────────────────────────────────────────────────────────

    /**
     * Decode a page. The order is the one a browser uses: the HTTP header wins,
     * then an in-document declaration, then UTF-8. A declared-but-unknown charset
     * silently falls back rather than failing the whole sync.
     */
    public String decode(byte[] body, String contentType) {
        Charset cs = fromHeader(contentType);
        if (cs == null) cs = fromMeta(body);
        if (cs == null) cs = StandardCharsets.UTF_8;
        try {
            return new String(body, cs);
        } catch (Exception e) {
            return new String(body, StandardCharsets.UTF_8);
        }
    }

    private Charset fromHeader(String contentType) {
        if (contentType == null) return null;
        for (String part : contentType.split(";")) {
            part = part.trim();
            if (part.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                return lookup(part.substring("charset=".length()).trim().replace("\"", ""));
            }
        }
        return null;
    }

    private Charset fromMeta(byte[] body) {
        // Only the head matters, and it is short enough to scan as Latin-1 without
        // risking a mid-character boundary.
        int head = Math.min(body.length, 2048);
        String prefix = new String(body, 0, head, StandardCharsets.ISO_8859_1).toLowerCase(Locale.ROOT);
        int m = prefix.indexOf("<meta");
        while (m >= 0) {
            int end = prefix.indexOf('>', m);
            if (end < 0) break;
            String tag = prefix.substring(m, end);
            int cs = tag.indexOf("charset");
            if (cs >= 0) {
                int eq = tag.indexOf('=', cs);
                if (eq >= 0) {
                    String val = tag.substring(eq + 1).trim().replace("\"", "").replace("'", "");
                    int cut = val.indexOf(';');
                    if (cut >= 0) val = val.substring(0, cut);
                    int space = val.indexOf(' ');
                    if (space > 0) val = val.substring(0, space);
                    Charset found = lookup(val.trim());
                    if (found != null) return found;
                }
            }
            m = prefix.indexOf("<meta", end);
        }
        return null;
    }

    private Charset lookup(String name) {
        if (name == null || name.isBlank()) return null;
        try {
            return Charset.forName(name);
        } catch (IllegalCharsetNameException | UnsupportedCharsetException e) {
            return null;
        }
    }

    // ── page → article ────────────────────────────────────────────────────────

    /** Fetch result in, readable article out. Never throws: a page we cannot make
     *  sense of yields an empty text rather than failing the sync. */
    public Article extract(byte[] body, String contentType, String baseUrl) {
        String html = decode(body, contentType);
        Document doc = Jsoup.parse(html, baseUrl == null ? "" : baseUrl);

        String title = firstNonBlank(doc.title(),
                textOf(doc.selectFirst("h1")),
                attr(doc.selectFirst("meta[property=og:title]"), "content"),
                "Untitled");

        Element container = bestContainer(doc);
        String text = container == null ? "" : normalize(textOf(container));
        if (text.isBlank()) text = normalize(textOf(doc.body()));
        if (text.isBlank()) text = normalize(textOf(doc));

        return new Article(title.trim(), text, text.length() > EXCERPT ? text.substring(0, EXCERPT) : text);
    }

    /**
     * Is this page a listing — a homepage, a channel page, an archive — rather than
     * an article? Link density says so far more reliably than text length: the
     * zzuli.edu.cn homepage carries 2 200 characters of headlines and never a
     * paragraph, and a pure length rule called that an article.
     */
    public boolean isListingPage(Document doc) {
        Element body = doc.body();
        if (body == null) return false;
        int total = normalize(textOf(body)).length();
        if (total < 200) return true;
        int anchor = 0;
        for (Element a : body.select("a[href]")) {
            anchor += normalize(textOf(a)).length();
        }
        return (double) anchor / total >= LISTING_ANCHOR_RATIO;
    }

    /** The longest plausible content container, so a page with both an <article>
     *  and a big footer does not lose its body. */
    private Element bestContainer(Document doc) {
        Element best = null;
        int bestLen = 0;
        for (String sel : CONTENT_SELECTORS) {
            for (Element el : doc.select(sel)) {
                int len = normalize(textOf(el)).length();
                if (len > bestLen) {
                    bestLen = len;
                    best = el;
                }
            }
        }
        // A container is only worth using if it carries real prose; a 3-line
        // <article> inside a page whose body has far more text is a comment box.
        if (best != null && bestLen >= 200) return best;

        Element body = doc.body();
        if (body == null) return best;
        Element clone = body.clone();
        clone.select(NOISE).remove();
        String fallback = normalize(textOf(clone));
        if (fallback.length() > bestLen) return clone;
        return best;
    }

    // ── listing page → article links ──────────────────────────────────────────

    /**
     * Article-shaped links on a listing page, in document order, capped.
     *
     * <p>Deliberately conservative: same host only, a real anchor text, and either a
     * date-shaped or article-shaped path. Nav menus ("学校概况" → /159/list.htm) fail
     * both, which is the point — a crawl of the navigation is not content.
     */
    public List<String> articleLinks(Document doc, URI base, int limit) {
        if (doc == null || base == null || base.getHost() == null) return List.of();
        Set<String> out = new LinkedHashSet<>();
        String host = base.getHost().toLowerCase(Locale.ROOT);
        for (Element a : doc.select("a[href]")) {
            if (out.size() >= limit) break;
            String href = a.attr("abs:href");
            String label = normalize(textOf(a));
            if (href.isBlank() || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
            if (label.length() < 4) continue;
            URI u;
            try {
                u = URI.create(href);
            } catch (IllegalArgumentException e) {
                continue;
            }
            String h = u.getHost();
            if (h == null || !h.toLowerCase(Locale.ROOT).endsWith(host)) continue;
            String path = u.getRawPath() == null ? "" : u.getRawPath();
            if (path.isBlank() || path.equals(base.getRawPath())) continue;
            if (LISTING_FILENAME.matcher(path).find()) continue; // a channel page, not an article
            boolean dateLike = DATE_IN_PATH.matcher(path).find();
            boolean articleLike = ARTICLE_IN_PATH.matcher(path).find();
            boolean titled = normalize(a.attr("title")).length() >= 8;
            if (!dateLike && !articleLike && !titled) continue;
            // strip the fragment: the same article is the same item
            String clean = u.getScheme() + "://" + u.getAuthority() + path
                    + (u.getRawQuery() == null ? "" : "?" + u.getRawQuery());
            out.add(clean);
        }
        return new ArrayList<>(out);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    static String textOf(Element el) {
        if (el == null) return "";
        String t = el.text();
        return t == null ? "" : t;
    }

    static String attr(Element el, String name) {
        return el == null ? null : el.attr(name);
    }

    static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return "";
    }

    /** Collapse runs of whitespace: nav text is "导 航  首 页", prose is not. */
    static String normalize(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\s\\u00A0\\u3000]+", " ").trim();
    }
}
