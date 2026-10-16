package com.signal.knowledge;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ContextBuilderTest {

    private static ScoredChunk chunk(String title, String content) {
        return new ScoredChunk(UUID.randomUUID(), UUID.randomUUID(), 0, content, 0.5,
                0.5, null, title, "https://example.com/a", "ARTICLE", "fake-embed");
    }

    /** The real corpus shape: every chunk of one information repeats title + summary. */
    private static final String HEADER =
            "Autoscaling runbook — how the cluster scales pods and what happens when it fails. ";

    @Test void numbersSourcesInRankOrderWithTitles() {
        var ctx = new ContextBuilder(8000).build(List.of(
                chunk("Runbook", "alpha"), chunk("Runbook", "beta")));

        assertEquals("[1] (source: Runbook)\nalpha\n\n[2] (source: Runbook)\nbeta\n\n", ctx.text());
        assertEquals(List.of(1, 2), ctx.includedIndexes());
        assertEquals(0, ctx.droppedForBudget());
    }

    @Test void stripsTheRepeatedHeaderBetweenChunksOfTheSameInformation() {
        var ctx = new ContextBuilder(8000).build(List.of(
                chunk("Runbook", HEADER + "Pods scale on CPU."),
                chunk("Runbook", HEADER + "The nightly backup runs at 02:30 UTC.")));

        assertTrue(ctx.text().contains("Pods scale on CPU."), ctx.text());
        assertTrue(ctx.text().contains("The nightly backup runs at 02:30 UTC."), ctx.text());
        assertEquals(1, count(ctx.text(), HEADER), "the shared header must appear once, not per chunk");
        assertEquals(HEADER.length(), ctx.deduplicatedChars());
    }

    @Test void dedupedBodyDoesNotStartWithTheSeparatorWhitespace() {
        var ctx = new ContextBuilder(8000).build(List.of(
                chunk("T", HEADER + "first"),
                chunk("T", HEADER + "  second")));
        assertTrue(ctx.text().contains("(source: T)\nsecond"), ctx.text());
        assertFalse(ctx.text().contains("\n  second"), "leading whitespace left over from the cut");
    }

    @Test void keepsAShortCoincidentalPrefix() {
        // "The " is 4 chars — shared by chance, not the repeated-header signal.
        var ctx = new ContextBuilder(8000).build(List.of(
                chunk("A", "The first document body."),
                chunk("B", "The second document body.")));

        assertEquals(0, ctx.deduplicatedChars());
        assertTrue(ctx.text().contains("The second document body."));
    }

    @Test void skipsASourceWhoseTextIsEntirelyRepeated() {
        String body = HEADER + "Pods scale on CPU.";
        var ctx = new ContextBuilder(8000).build(List.of(chunk("T", body), chunk("T", body)));

        assertEquals(1, ctx.size());
        assertEquals(1, ctx.skippedDuplicates());
        assertFalse(ctx.text().contains("[2]"), "a fully repeated source is not worth a number");
    }

    @Test void numberingStaysContiguousWhenASourceIsSkipped() {
        String body = HEADER + "shared";
        var ctx = new ContextBuilder(8000).build(List.of(
                chunk("T", body),
                chunk("T", body),
                chunk("T", HEADER + "genuinely new")));

        assertEquals(List.of(1, 3), ctx.includedIndexes(), "positions point back at the input list");
        assertTrue(ctx.text().contains("[2] (source: T)\ngenuinely new"),
                "the number handed to the model is contiguous — no gap to cite into: " + ctx.text());
        assertFalse(ctx.text().contains("[3]"), ctx.text());
    }

    @Test void stopsAtTheBudgetButAlwaysKeepsTheFirstSource() {
        var ctx = new ContextBuilder(200).build(List.of(
                chunk("T", "x".repeat(400)), chunk("T", "tail")));

        assertTrue(ctx.text().contains("xxx"), "an oversized first source is still sent");
        assertFalse(ctx.text().contains("tail"), "later sources are dropped once the budget is spent");
        assertEquals(1, ctx.droppedForBudget());
    }

    @Test void emptyInputYieldsAnEmptyContext() {
        var ctx = new ContextBuilder(8000).build(List.of());
        assertTrue(ctx.isEmpty());
        assertEquals("", ctx.text());
        assertEquals(0, ctx.size());
    }

    @Test void blankContentStillProducesAUsableHeader() {
        var ctx = new ContextBuilder(8000).build(List.of(chunk("Only a title", "")));
        assertEquals(1, ctx.size());
        assertTrue(ctx.text().startsWith("[1] (source: Only a title)"));
    }

    @Test void nonPositiveBudgetFallsBackToTheDefault() {
        var ctx = new ContextBuilder(0).build(List.of(chunk("T", "body")));
        assertEquals(1, ctx.size(), "a misconfigured budget must not blank the context");
    }

    private static int count(String haystack, String needle) {
        int n = 0;
        for (int i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length())) n++;
        return n;
    }
}
