package com.signal.discover;

import com.signal.ingestion.pipeline.FeedGateway;
import com.signal.ingestion.pipeline.HttpFetcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The verification gate behind every discover suggestion. The model's job is to guess
 * what might fit; this class's job is to be sure — a candidate only survives if its URL
 * is fetched right now and yields an usable subscription: an RSS/Atom feed that parses
 * into at least one entry, or a GitHub repository that answers on the public API.
 *
 * <p>All fetching goes through {@link HttpFetcher} (never a bare client) so every hop
 * inherits the ingress pipeline's SSRF guard, timeouts and size caps. A fabricated
 * domain simply dies here instead of reaching the user.
 */
@Component
public class CandidateVerifier {

    private static final Logger log = LoggerFactory.getLogger(CandidateVerifier.class);

    /** path roots that were never a repository; a model guessing <owner>/<repo> from these is filtered */
    private static final Set<String> NOT_REPO_ROOTS = Set.of(
            "topics", "search", "orgs", "explore", "settings", "notifications", "features");

    private final HttpFetcher fetcher;
    private final FeedGateway feeds;
    private final ObjectMapper json = new ObjectMapper();
    private final String apiBase;

    public CandidateVerifier(HttpFetcher fetcher, FeedGateway feeds,
                             @Value("${github.api-base:https://api.github.com}") String apiBase) {
        this.fetcher = fetcher;
        this.feeds = feeds;
        this.apiBase = apiBase;
    }

    /** True only when this exact URL, fetched now, yields the subscription it claims to be. */
    public boolean verify(String type, String url) {
        if (url == null || url.isBlank()) return false;
        try {
            if ("GITHUB".equalsIgnoreCase(type)) return verifyRepo(url);
            if ("RSS".equalsIgnoreCase(type)) return verifyFeed(url);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.debug("Candidate rejected ({}): {}", url, e.toString());
        }
        return false;
    }

    /** An RSS candidate must be a feed URL that parses — not a homepage we squint at. */
    boolean verifyFeed(String url) throws Exception {
        HttpFetcher.FetchResult r = fetcher.getResult(url);
        if (!feeds.looksLikeFeed(r.body(), r.contentType())) return false;
        return !feeds.parse(r.body()).isEmpty();
    }

    /** A GitHub candidate must resolve to a live repository on the public API. */
    boolean verifyRepo(String url) throws Exception {
        String repo = ownerRepo(url);
        if (repo == null) return false;
        try {
            JsonNode repoJson = json.readTree(fetcher.get(apiBase + "/repos/" + repo));
            return repoJson.hasNonNull("full_name") && !repoJson.path("message").isTextual();
        } catch (HttpFetcher.FetchFailedException e) {
            return false; // a 404 repo must not look like a verification failure worth retrying
        }
    }

    /**
     * owner/repo from any github.com URL shape; {@code null} for anything that is not a
     * repository page (topics, search, org dashboards — the collector cannot subscribe to those).
     */
    static String ownerRepo(String url) {
        try {
            List<String> parts = List.of(URI.create(url.trim()).getPath()
                    .replaceAll("/*$", "").split("/"))
                    .stream().filter(s -> !s.isEmpty()).toList();
            if (parts.size() < 2) return null;
            String first = parts.get(0).toLowerCase(Locale.ROOT);
            if (first.endsWith(".git")) first = first.substring(0, first.length() - 4);
            if (NOT_REPO_ROOTS.contains(first)) return null;
            String second = parts.get(1);
            return second.isBlank() ? null : first + "/" + second.replaceFirst("\\.git$", "");
        } catch (Exception e) {
            return null;
        }
    }
}
