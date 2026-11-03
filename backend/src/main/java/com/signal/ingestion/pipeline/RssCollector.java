package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.pipeline.CollectFailure.Reason;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * RSS/Atom collector.
 *
 * <p>Two additions, both answering real complaints:
 * <ul>
 *   <li>a source typed RSS pointing at a normal website used to die on Rome's parse
 *       error. It now says so plainly (NOT_A_FEED), and if the site happens to
 *       publish a feed the collector follows it instead of failing;</li>
 *   <li>a feed entry whose description is one sentence — which is most of them —
 *       used to be ingested as the whole article, so understanding saw 200 characters
 *       and scored it low. Entries with a link and a short body now have that body
 *       fetched and extracted (bounded, and a failure keeps the summary).</li>
 * </ul>
 */
@Component
public class RssCollector implements SourceCollector {

    private final HttpFetcher fetcher;
    private final ArticleExtractor extractor;
    private final FeedGateway feeds;

    /** Shorter than this, an entry is a teaser and worth fetching in full. */
    private final int minFullTextChars;
    /** How many entries per feed get the full-text treatment. */
    private final int fullTextMax;

    public RssCollector(HttpFetcher fetcher,
                        ArticleExtractor extractor,
                        FeedGateway feeds,
                        @Value("${ingestion.rss.fulltext-min-chars:400}") int minFullTextChars,
                        @Value("${ingestion.rss.fulltext-max:8}") int fullTextMax) {
        this.fetcher = fetcher;
        this.extractor = extractor;
        this.feeds = feeds;
        this.minFullTextChars = minFullTextChars;
        this.fullTextMax = Math.max(0, fullTextMax);
    }

    @Override public boolean supports(String type) { return "RSS".equalsIgnoreCase(type); }

    @Override
    public CollectResult collect(Source source) throws Exception {
        String url = source.getUrl();
        HttpFetcher.FetchResult fetched = fetcher.getResult(url);
        byte[] body = fetched.body();
        String ct = fetched.contentType();

        if (!feeds.looksLikeFeed(body, ct)) {
            String html = extractor.decode(body, ct);
            String discovered = feeds.discover(url, html);
            if (discovered != null) {
                try {
                    List<NormalizedItem> items = toItems(feeds.parse(fetcher.getResult(discovered).body()));
                    return CollectResult.resolved(items, discovered, "RSS");
                } catch (Exception e) {
                    throw CollectFailure.of(e);
                }
            }
            throw new CollectFailure(Reason.NOT_A_FEED,
                    "URL " + url + " is a web page, not an RSS/Atom feed, and the site "
                            + "publishes no discoverable feed");
        }

        List<FeedGateway.Entry> entries = feeds.parse(body);
        int enriched = 0;
        for (FeedGateway.Entry e : entries) {
            if (enriched >= fullTextMax) break;
            if (e.text() == null || e.text().length() >= minFullTextChars) continue;
            String link = e.url() != null ? e.url() : e.externalId();
            if (link == null || !link.startsWith("http")) continue;
            try {
                HttpFetcher.FetchResult r = fetcher.getResult(link);
                ArticleExtractor.Article a = extractor.extract(r.body(), r.contentType(), link);
                if (a.text().length() <= e.text().length()) continue; // worse than the summary
                entries.set(entries.indexOf(e), withText(e, a.text(), a.excerpt(), a.title()));
                enriched++;
            } catch (Exception ignored) {
                // a teaser we cannot fetch is still an item; the sync must not fail
            }
        }
        return CollectResult.of(toItems(entries));
    }

    private FeedGateway.Entry withText(FeedGateway.Entry e, String text, String excerpt, String title) {
        return new FeedGateway.Entry(e.externalId(), title != null && !title.isBlank() ? title : e.title(),
                text, excerpt, e.url(), e.author(), e.publishedAt(), e.type(), e.metadata());
    }

    private List<NormalizedItem> toItems(List<FeedGateway.Entry> entries) {
        return entries.stream().map(e -> {
            String url = e.url() != null ? e.url() : e.externalId();
            return new NormalizedItem(
                    e.externalId() != null ? e.externalId() : Hashing.canonicalUrl(url),
                    e.title(), e.text(), e.excerpt(), url, e.author(), e.publishedAt(),
                    e.type(), null, e.metadata() == null ? java.util.Map.of() : e.metadata());
        }).toList();
    }
}
