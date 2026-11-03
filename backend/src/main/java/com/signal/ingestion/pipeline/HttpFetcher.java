package com.signal.ingestion.pipeline;

import com.signal.ingestion.security.UrlValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Bounded HTTP fetch with MANUAL redirect following:
 * every redirect hop is re-validated by UrlValidator (scheme + resolved IP),
 * so "public URL → redirect → localhost/private/metadata" is blocked.
 * DNS-rebinding between resolve and connect remains a documented DEFERRED item.
 *
 * <p>Three real-world traps this class now survives, all of them seen as
 * "the source will not sync" in the wild:
 * <ul>
 *   <li>a URL with a space or non-ASCII character — {@link URI#create} throws
 *       {@link IllegalArgumentException}, which used to escape the IOException catch
 *       and surface as a 500 instead of a fetch failure;</li>
 *   <li>sites that answer 403 to a bare bot User-Agent, so a real browser
 *       headers set is sent;</li>
 *   <li>a charset that is not UTF-8 — the caller now learns the Content-Type and
 *       can decode with it instead of turning GBK pages into mojibake.</li>
 * </ul>
 */
@Component
public class HttpFetcher {

    public static class FetchFailedException extends RuntimeException {
        public FetchFailedException(String m) { super(m); }
    }
    public static class PayloadTooLargeException extends RuntimeException {
        public PayloadTooLargeException(String m) { super(m); }
    }

    public record FetchResult(byte[] body, String finalUrl, String contentType, int status) {}

    private static final int MAX_REDIRECTS = 5;
    private static final String UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/124.0 Safari/537.36 SIGNAL-Information-OS";

    private final HttpClient client;
    private final UrlValidator validator;
    private final long maxBytes;
    private final long timeoutMs;

    public HttpFetcher(UrlValidator validator,
                       @Value("${ingestion.http-timeout-ms:8000}") long timeoutMs,
                       @Value("${ingestion.max-response-bytes:5242880}") long maxBytes) {
        this.validator = validator;
        this.timeoutMs = timeoutMs;
        this.maxBytes = maxBytes;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(timeoutMs))
                .followRedirects(HttpClient.Redirect.NEVER) // we validate each hop ourselves
                .build();
    }

    /** Body only — kept for callers that do not care where it came from. */
    public byte[] get(String url) {
        return getResult(url).body();
    }

    public FetchResult getResult(String url) {
        String current = UrlCodec.normalize(url);
        validator.validate(current);
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpResponse<InputStream> res;
            try {
                HttpRequest req = HttpRequest.newBuilder(URI.create(current))
                        .timeout(Duration.ofMillis(timeoutMs))
                        .header("User-Agent", UA)
                        .header("Accept",
                                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                        .GET().build();
                res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                throw new FetchFailedException("Fetch failed: " + e.getMessage());
            } catch (IllegalArgumentException e) {
                // A URL that survives normalize() but still will not parse as a URI.
                throw new FetchFailedException("Invalid URL: " + e.getMessage());
            }
            int status = res.statusCode();
            if (status >= 300 && status < 400) {
                String location = res.headers().firstValue("Location").orElse(null);
                if (location == null || hop == MAX_REDIRECTS)
                    throw new FetchFailedException("Redirect loop or missing Location");
                URI next;
                try {
                    next = URI.create(current).resolve(location.trim());
                } catch (IllegalArgumentException e) {
                    throw new FetchFailedException("Invalid redirect target");
                }
                validator.validate(next.toString()); // re-block private/loopback on EVERY hop
                current = next.toString();
                continue;
            }
            if (status >= 400) throw new FetchFailedException("HTTP " + status);
            byte[] body = readBounded(res);
            return new FetchResult(body, current,
                    res.headers().firstValue("Content-Type").orElse(null), status);
        }
        throw new FetchFailedException("Too many redirects");
    }

    private byte[] readBounded(HttpResponse<InputStream> res) {
        try (InputStream in = res.body()) {
            byte[] buf = new byte[8192];
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            int n; long total = 0;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > maxBytes) throw new PayloadTooLargeException("Response exceeds size limit");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new FetchFailedException("Read failed");
        }
    }
}
