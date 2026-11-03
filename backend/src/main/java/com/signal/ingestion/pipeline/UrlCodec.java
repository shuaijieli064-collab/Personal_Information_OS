package com.signal.ingestion.pipeline;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;

/**
 * Turns the URL a user pasted into one {@link URI} and HttpClient will accept.
 *
 * <p>Lives on its own because both the fetcher and the SSRF validator need the same
 * canonical form: a URL with a space or a CJK character must be encoded once, before
 * either of them looks at it. Otherwise the validator calls it invalid, which surfaces
 * as "出于安全考虑，这个地址不被允许访问" — the wrong answer for a merely sloppy paste.
 */
public final class UrlCodec {

    private UrlCodec() {}

    /** Sub-delims plus the path characters that must survive: '/' and ':'. */
    private static final String SAFE_PATH = "-._~!$&'()*+,;=:@/";
    /** In a query '/' and '?' are data, not separators, so they get encoded. */
    private static final String SAFE_QUERY = "-._~!$&'()*+,;=:@";

    /**
     * Percent-encode what a browser would encode. Already-valid input is returned
     * untouched — {@link URI} treats '%' as data, so re-encoding would double-escape
     * "%20" into "%2520".
     *
     * @throws com.signal.ingestion.pipeline.HttpFetcher.FetchFailedException when the
     *         URL has no scheme or no host, which no encoding can fix
     */
    public static String normalize(String raw) {
        String url = raw == null ? "" : raw.trim();
        // Java's URI constructor accepts non-ASCII, but HttpClient will not: it needs
        // the request target to be pure ASCII. "Parses" is therefore not enough — it
        // must also be ASCII and carry a scheme + host.
        try {
            URI parsed = new URI(url);
            if (parsed.getScheme() != null && parsed.getHost() != null && isPureAscii(url)) {
                return url;
            }
        } catch (URISyntaxException e) {
            // Not a parseable URI — a character in it needs encoding. Split it by hand,
            // because URI.create() cannot build the pieces of a URI it just refused.
        }
        return reencode(url);
    }

    private static boolean isPureAscii(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c > 0x7E || (c < 0x20 && c != '\t')) return false;
        }
        return true;
    }

    /** scheme://authority + encoded path + encoded query + encoded fragment. */
    private static String reencode(String url) {
        int schemeEnd = url.indexOf("://");
        if (schemeEnd < 0) throw invalid("no scheme");
        String scheme = url.substring(0, schemeEnd);
        String rest = url.substring(schemeEnd + 3);
        int pathStart = -1;
        for (int i = 0; i < rest.length(); i++) {
            char c = rest.charAt(i);
            if (c == '/' || c == '?' || c == '#') { pathStart = i; break; }
        }
        String authority = pathStart < 0 ? rest : rest.substring(0, pathStart);
        String tail = pathStart < 0 ? "" : rest.substring(pathStart);
        if (authority.isBlank()) throw invalid("no host");
        int q = tail.indexOf('?'), h = tail.indexOf('#');
        String path = q >= 0 ? tail.substring(0, q) : (h >= 0 ? tail.substring(0, h) : tail);
        String query = q >= 0 ? (h >= 0 ? tail.substring(q + 1, h) : tail.substring(q + 1)) : null;
        String fragment = h >= 0 ? tail.substring(h + 1) : null;
        return scheme + "://" + authority + encode(path, true)
                + (query == null ? "" : "?" + encode(query, false))
                + (fragment == null ? "" : "#" + encode(fragment, false));
    }

    private static HttpFetcher.FetchFailedException invalid(String why) {
        return new HttpFetcher.FetchFailedException("Invalid URL: " + why);
    }

    /**
     * Everything outside the sub-delims and the separators of its component gets
     * encoded — but *letters and digits are safe by definition*, a category the
     * punctuation-only set below obviously cannot cover. Missing them encoded
     * "a b.html" into "%61%20%62.%68%74%6D%6C".
     */
    static String encode(String s, boolean isPath) {
        if (s == null || s.isEmpty()) return s;
        String safe = isPath ? SAFE_PATH : SAFE_QUERY;
        StringBuilder out = new StringBuilder(s.length() * 2);
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) {
            char c = (char) (b & 0xFF);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                    || safe.indexOf(c) >= 0 || c == '%';
            if (ok) out.append(c);
            else out.append('%').append(String.format("%02X", b & 0xFF));
        }
        return out.toString();
    }
}
