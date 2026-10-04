package com.signal.ingestion.pipeline;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.security.UrlValidator;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/** One-off URL import: fetch → SSRF-check → extract title/main text. No perfect extraction. */
@Component
public class UrlCollector implements SourceCollector {

    private final HttpFetcher fetcher;
    private final UrlValidator validator;

    public UrlCollector(HttpFetcher fetcher, UrlValidator validator) {
        this.fetcher = fetcher;
        this.validator = validator;
    }

    @Override public boolean supports(String type) { return "URL".equalsIgnoreCase(type); }

    @Override
    public List<NormalizedItem> collect(Source source) {
        validator.validate(source.getUrl());
        byte[] body = fetcher.get(source.getUrl());
        String html = new String(body, StandardCharsets.UTF_8);
        Document doc = Jsoup.parse(html, source.getUrl());

        String title = doc.title() == null || doc.title().isBlank() ? "Untitled" : doc.title().trim();
        var main = doc.selectFirst("article");
        if (main == null) main = doc.body();
        String text = main == null ? "" : Jsoup.clean(main.html(), Safelist.none());
        if (text.isBlank()) text = Jsoup.clean(html, Safelist.none());

        String excerpt = text.length() > 280 ? text.substring(0, 280) : text;
        return List.of(new NormalizedItem(
                Hashing.canonicalUrl(source.getUrl()), title, text, excerpt,
                source.getUrl(), null, null, "ARTICLE", null, Map.of()));
    }
}
