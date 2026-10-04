package com.signal.ingestion.pipeline;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.signal.ingestion.entity.Source;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Public GitHub API only — no HTML scraping, no auth (public data). */
@Component
public class GithubCollector implements SourceCollector {

    private final HttpFetcher fetcher;
    private final ObjectMapper json = new ObjectMapper();
    private final String apiBase;
    private final int maxItems;

    public GithubCollector(HttpFetcher fetcher,
                           @Value("${github.api-base:https://api.github.com}") String apiBase,
                           @Value("${github.max-items:5}") int maxItems) {
        this.fetcher = fetcher;
        this.apiBase = apiBase;
        this.maxItems = maxItems;
    }

    @Override public boolean supports(String type) { return "GITHUB".equalsIgnoreCase(type); }

    private String ownerRepo(Source s) {
        String path = s.getUrl().replaceFirst("\\.git$", "").replaceAll("/*$", "");
        String[] parts = path.replace("https://github.com/", "").split("/");
        if (parts.length < 2) throw new IllegalArgumentException("Invalid GitHub repository URL");
        return parts[0] + "/" + parts[1];
    }

    private JsonNode getJson(String path) throws Exception {
        return json.readTree(fetcher.get(apiBase + path));
    }

    @Override
    public List<NormalizedItem> collect(Source source) throws Exception {
        String repo = ownerRepo(source);
        List<NormalizedItem> out = new ArrayList<>();

        JsonNode releases = getJson("/repos/" + repo + "/releases?per_page=" + maxItems);
        if (releases.isArray()) for (JsonNode r : releases) out.add(item("release:" + r.path("id").asText(),
                "Release: " + r.path("tag_name").asText(repo), clean(r.path("body").asText("")),
                r.path("html_url").asText(), r.path("author").path("login").asText(null),
                r.path("published_at").asText(null), "RELEASE"));

        JsonNode issues = getJson("/repos/" + repo + "/issues?state=all&per_page=" + maxItems);
        if (issues.isArray()) for (JsonNode i : issues) {
            if (i.has("pull_request")) continue; // issues endpoint also returns PRs
            out.add(item("issue:" + i.path("number").asText(),
                    i.path("title").asText("Untitled"), clean(i.path("body").asText("")),
                    i.path("html_url").asText(), i.path("user").path("login").asText(null),
                    i.path("created_at").asText(null), "ISSUE"));
        }

        JsonNode pulls = getJson("/repos/" + repo + "/pulls?state=all&per_page=" + maxItems);
        if (pulls.isArray()) for (JsonNode p : pulls) out.add(item("pull:" + p.path("number").asText(),
                p.path("title").asText("Untitled"), clean(p.path("body").asText("")),
                p.path("html_url").asText(), p.path("user").path("login").asText(null),
                p.path("created_at").asText(null), "PULL_REQUEST"));

        return out;
    }

    private NormalizedItem item(String extId, String title, String body, String url,
                                String author, String publishedAt, String type) {
        String text = body == null ? "" : body;
        String excerpt = text.length() > 280 ? text.substring(0, 280) : text;
        Instant pub = null;
        if (publishedAt != null && !publishedAt.isBlank()) {
            try { pub = Instant.parse(publishedAt); } catch (Exception ignored) {}
        }
        return new NormalizedItem(extId, title, text, excerpt, url, author, pub, type, null, new HashMap<>());
    }

    private String clean(String html) {
        return html == null ? "" : Jsoup.clean(html, org.jsoup.safety.Safelist.none());
    }
}
