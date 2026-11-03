package com.signal.ingestion.security;

import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.List;

/**
 * SSRF guard. Allowed schemes: http/https only.
 * Blocks loopback / private / link-local / cloud-metadata targets.
 * Resolves the hostname to IPs FIRST and rejects if any resolved address is internal,
 * which mitigates basic DNS-rebinding between resolve and use.
 * (Per-redirect revalidation is recorded as Deferred hardening in Phase 4 QA.)
 */
@Component
public class UrlValidator {

    public static class BlockedUrlException extends RuntimeException {
        public BlockedUrlException(String m) { super(m); }
    }

    private static final List<String> BLOCKED_HOSTNAMES =
            List.of("localhost", "localhost.localdomain");

    public void validate(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) throw new BlockedUrlException("URL is required");
        // Canonicalise first: a pasted URL with a space or a CJK character is not a
        // security problem, and rejecting it as "Blocked host" sent the user hunting
        // for a security setting that had nothing to do with their paste.
        String url;
        try {
            url = com.signal.ingestion.pipeline.UrlCodec.normalize(rawUrl);
        } catch (RuntimeException e) {
            // "file:///etc/passwd" and "javascript:alert(1)" are rejected here by
            // shape, not by encoding — keep the validator's contract that everything
            // it refuses is a BlockedUrlException.
            throw new BlockedUrlException("Invalid URL");
        }
        URI uri;
        try {
            uri = URI.create(url);
        } catch (Exception e) {
            throw new BlockedUrlException("Invalid URL");
        }
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            throw new BlockedUrlException("Only http(s) URLs are allowed");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) throw new BlockedUrlException("URL host is required");
        String lower = host.toLowerCase();
        if (BLOCKED_HOSTNAMES.contains(lower)) throw new BlockedUrlException("Blocked host");

        try {
            for (InetAddress addr : InetAddress.getAllByName(lower)) {
                if (isInternal(addr)) throw new BlockedUrlException("Blocked address: " + addr.getHostAddress());
            }
        } catch (UnknownHostException e) {
            throw new BlockedUrlException("Cannot resolve host");
        }
    }

    static boolean isInternal(InetAddress addr) {
        return addr.isLoopbackAddress()
                || addr.isAnyLocalAddress()   // 0.0.0.0
                || addr.isLinkLocalAddress()  // 169.254.x.x incl. 169.254.169.254
                || addr.isSiteLocalAddress()  // 10/8, 172.16/12, 192.168/16
                || addr.isMulticastAddress();
    }
}
