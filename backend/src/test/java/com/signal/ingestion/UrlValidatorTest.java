package com.signal.ingestion;

import com.signal.ingestion.security.UrlValidator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UrlValidatorTest {

    private final UrlValidator v = new UrlValidator();

    @Test void blocksLoopback() {
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("http://127.0.0.1"));
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("http://localhost"));
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("http://[::1]"));
    }

    @Test void blocksPrivateRanges() {
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("http://10.0.0.5"));
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("http://172.16.4.4"));
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("http://192.168.1.1"));
    }

    @Test void blocksMetadataEndpoint() {
        assertThrows(UrlValidator.BlockedUrlException.class,
                () -> v.validate("http://169.254.169.254/latest/meta-data/"));
    }

    @Test void blocksNonHttpSchemes() {
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("file:///etc/passwd"));
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("javascript:alert(1)"));
        assertThrows(UrlValidator.BlockedUrlException.class, () -> v.validate("ftp://example.com/x"));
    }
}
