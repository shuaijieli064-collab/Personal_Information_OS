package com.signal.ingestion;

import com.signal.ingestion.pipeline.Hashing;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HashingTest {

    @Test void sha256IsDeterministic() {
        assertEquals(Hashing.sha256("abc"), Hashing.sha256("abc"));
        assertNotEquals(Hashing.sha256("abc"), Hashing.sha256("abd"));
        assertEquals(64, Hashing.sha256("x").length());
    }

    @Test void canonicalStripsFragmentAndTrailingSlash() {
        assertEquals("https://example.com/article",
                Hashing.canonicalUrl("https://example.com/article/#section"));
        assertEquals("https://example.com/article",
                Hashing.canonicalUrl("https://example.com/article/"));
    }
}
