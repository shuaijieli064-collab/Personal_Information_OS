package com.signal.ingestion.pipeline;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * URL normalisation is the difference between "this source will not sync" and a
 * successful fetch. {@code URI.create} throws on a space or a CJK character, and that
 * IllegalArgumentException used to escape the IOException catch and surface as a 500.
 */
class UrlCodecTest {

    @Nested
    @DisplayName("normalize")
    class Normalize {

        @Test
        void leavesAnAlreadyValidUrlAlone() {
            assertEquals("https://example.com/a/b?x=1#f",
                    UrlCodec.normalize("https://example.com/a/b?x=1#f"));
        }

        @Test
        void encodesASpaceInThePath() {
            assertEquals("https://example.com/a%20b.html",
                    UrlCodec.normalize("https://example.com/a b.html"));
        }

        @Test
        void encodesNonAsciiAsUtf8() {
            assertEquals("https://example.com/%E6%96%87%E7%AB%A0.html",
                    UrlCodec.normalize("https://example.com/文章.html"));
        }

        @Test
        void doesNotDoubleEscapeAnAlreadyEncodedUrl() {
            assertEquals("https://example.com/a%20b.html",
                    UrlCodec.normalize("https://example.com/a%20b.html"));
        }

        @Test
        void keepsQuerySeparatorsAndEncodesTheRest() {
            assertEquals("https://example.com/s?a=1&b=%E4%B8%AD",
                    UrlCodec.normalize("https://example.com/s?a=1&b=中"));
        }

        @Test
        void keepsSlashesInThePath() {
            assertEquals("https://example.com/2026/1016/c1/page.htm",
                    UrlCodec.normalize("https://example.com/2026/1016/c1/page.htm"));
        }

        @Test
        void rejectsAUrlWithoutAScheme() {
            assertThrows(HttpFetcher.FetchFailedException.class,
                    () -> UrlCodec.normalize("www.example.com/page"));
        }

        @Test
        void rejectsAUrlWithoutAHost() {
            assertThrows(HttpFetcher.FetchFailedException.class,
                    () -> UrlCodec.normalize("https:///page"));
        }
    }
}
