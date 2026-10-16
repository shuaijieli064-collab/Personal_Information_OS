package com.signal.knowledge;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Phase 6 K5 — Context Builder: turns retrieved chunks into the numbered SOURCES block
 * the RAG prompt consumes.
 *
 * <p>Two things it does that plain concatenation does not:
 *
 * <ul>
 *   <li><b>De-duplication.</b> Chunk text is {@code title + understanding summary + body}
 *       (see {@code ChunkService}), so every chunk of the same information repeats an
 *       identical header — and the splitter adds a 150-char tail overlap on top. Sending
 *       that repetition wastes the budget and invites the model to read one claim as two
 *       independent pieces of evidence. The prefix shared with the previous chunk is
 *       stripped once it is long enough to be repetition rather than coincidence.</li>
 *   <li><b>Budgeting.</b> Sources are added in rank order until the character budget is
 *       reached, so a long tail of low-relevance chunks cannot crowd out the context
 *       window. The first source is always kept even if it alone exceeds the budget — an
 *       empty context turns a RAG answer into a guaranteed hallucination.</li>
 * </ul>
 *
 * <p>The builder reports <b>which</b> sources it kept, and that list is what citations
 * must be built from: listing a source the model never received lets the answer cite a
 * number that was never in front of it.
 */
@Component
public class ContextBuilder {

    static final int DEFAULT_MAX_CHARS = 8000;
    /** Below this a shared prefix is more likely coincidence than repeated boilerplate. */
    static final int MIN_SHARED_PREFIX = 40;
    /** Cap the scan — a chunk header is short; a longer match is not the duplication we target. */
    static final int MAX_SHARED_PREFIX = 600;

    private final int maxChars;

    public ContextBuilder(@Value("${app.knowledge.context-max-chars:8000}") int maxChars) {
        this.maxChars = maxChars > 0 ? maxChars : DEFAULT_MAX_CHARS;
    }

    /**
     * The assembled SOURCES text plus what it contains.
     *
     * @param text              the numbered block handed to the model
     * @param includedIndexes   1-based positions in the input list that made it in, in the
     *                          order they appear — citations are built from this
     * @param droppedForBudget  sources omitted because the budget ran out
     * @param skippedDuplicates sources whose text was entirely a repeat of an earlier one
     * @param deduplicatedChars characters removed as repeated headers/overlap
     */
    public record BuiltContext(String text, List<Integer> includedIndexes,
                               int droppedForBudget, int skippedDuplicates,
                               int deduplicatedChars) {

        public boolean isEmpty() { return includedIndexes.isEmpty(); }

        public int size() { return includedIndexes.size(); }
    }

    public BuiltContext build(List<ScoredChunk> sources) {
        StringBuilder sb = new StringBuilder();
        List<Integer> included = new ArrayList<>();
        int dropped = 0;
        int skipped = 0;
        int deduplicatedChars = 0;
        String previous = null;

        for (int i = 0; i < sources.size(); i++) {
            ScoredChunk c = sources.get(i);
            String raw = c.content() == null ? "" : c.content();
            String body = dedupe(previous, raw);

            // Nothing new in this source: it repeats an earlier one verbatim. Keeping it
            // would only add a header and a duplicate citation number.
            if (body.isBlank() && !included.isEmpty()) {
                skipped++;
                deduplicatedChars += raw.length() - body.length();
                continue;
            }

            // Numbered over the sources actually kept, so [1..n] is always contiguous —
            // a gap would let the model cite a number that does not exist.
            int number = included.size() + 1;
            String title = c.title() == null ? "" : c.title();
            String block = "[" + number + "] (source: " + title + ")\n" + body + "\n\n";

            if (!included.isEmpty() && sb.length() + block.length() > maxChars) {
                dropped = sources.size() - i;
                break;
            }

            sb.append(block);
            included.add(i + 1);
            deduplicatedChars += raw.length() - body.length();
            previous = raw;
        }

        return new BuiltContext(sb.toString(), List.copyOf(included), dropped, skipped, deduplicatedChars);
    }

    /**
     * Strips the prefix {@code current} shares with {@code previous} — the repeated
     * title/summary header, or a chunk overlap — once it is long enough to be
     * intentional repetition. Returns {@code current} unchanged when there is no
     * previous chunk or the shared run is too short to mean anything.
     */
    static String dedupe(String previous, String current) {
        if (previous == null || current == null || current.isEmpty()) return current;
        int limit = Math.min(Math.min(previous.length(), current.length()), MAX_SHARED_PREFIX);
        int shared = 0;
        while (shared < limit && previous.charAt(shared) == current.charAt(shared)) shared++;
        if (shared < MIN_SHARED_PREFIX) return current;
        return current.substring(shared).stripLeading();
    }
}
