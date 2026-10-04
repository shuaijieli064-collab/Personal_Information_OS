package com.signal.ingestion.pipeline;

import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import com.signal.ingestion.entity.Source;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class RssCollector implements SourceCollector {

    private final HttpFetcher fetcher;

    public RssCollector(HttpFetcher fetcher) { this.fetcher = fetcher; }

    @Override public boolean supports(String type) { return "RSS".equalsIgnoreCase(type); }

    @Override
    public List<NormalizedItem> collect(Source source) throws Exception {
        byte[] body = fetcher.get(source.getUrl());
        SyndFeed feed;
        try (XmlReader reader = new XmlReader(new ByteArrayInputStream(body))) {
            feed = new SyndFeedInput().build(reader);
        }
        List<NormalizedItem> out = new ArrayList<>();
        for (SyndEntry e : feed.getEntries()) {
            String rawHtml = e.getDescription() != null ? e.getDescription().getValue() : "";
            if (rawHtml.isBlank() && e.getContents() != null && !e.getContents().isEmpty()) {
                rawHtml = e.getContents().get(0).getValue();
            }
            String text = Jsoup.clean(rawHtml, org.jsoup.safety.Safelist.none());
            String title = e.getTitle() == null || e.getTitle().isBlank() ? "Untitled" : e.getTitle().trim();
            Instant pub = e.getPublishedDate() != null ? e.getPublishedDate().toInstant()
                    : (e.getUpdatedDate() != null ? e.getUpdatedDate().toInstant() : null);
            String author = e.getAuthor() != null && !e.getAuthor().isBlank()
                    ? e.getAuthor() : null;
            Map<String, Object> meta = new HashMap<>();
            out.add(new NormalizedItem(
                    e.getUri() != null ? e.getUri() : e.getLink(),
                    title, text,
                    text.length() > 280 ? text.substring(0, 280) : text,
                    e.getLink(), author, pub, "ARTICLE", null, meta));
        }
        return out;
    }
}
