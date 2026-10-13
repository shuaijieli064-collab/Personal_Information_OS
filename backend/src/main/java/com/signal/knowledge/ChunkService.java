package com.signal.knowledge;

import com.signal.ai.EmbeddingProvider;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.understanding.entity.InformationUnderstanding;
import com.signal.understanding.repository.InformationUnderstandingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 6 K2 — Document/Information chunking + embedding pipeline.
 * Corpus = title + (understanding summary when present) + content/excerpt.
 * Embedding happens OUTSIDE DB transactions (real provider is network);
 * per-item isolation: one failure never aborts a sync or batch.
 */
@Service
public class ChunkService {

    private static final Logger log = LoggerFactory.getLogger(ChunkService.class);

    private final EmbeddingProvider embeddings;
    private final ChunkStore store;
    private final InformationRepository information;
    private final InformationUnderstandingRepository understandings;
    private final int maxChars;
    private final int overlap;
    /** Expected vector width — must match the schema (V17 = 1024). */
    private final int embeddingDimensions;

    public ChunkService(EmbeddingProvider embeddings,
                        ChunkStore store,
                        InformationRepository information,
                        InformationUnderstandingRepository understandings,
                        @Value("${app.knowledge.chunk-size:800}") int maxChars,
                        @Value("${app.knowledge.chunk-overlap:150}") int overlap,
                        @Value("${ai.embedding-dimensions:1024}") int embeddingDimensions) {
        if (maxChars < 200) throw new IllegalArgumentException("chunk-size too small");
        if (overlap < 0 || overlap >= maxChars) throw new IllegalArgumentException("chunk-overlap out of range");
        this.embeddings = embeddings;
        this.store = store;
        this.information = information;
        this.understandings = understandings;
        this.maxChars = maxChars;
        this.overlap = overlap;
        this.embeddingDimensions = embeddingDimensions;
    }

    public record ReindexResult(int scanned, int chunked, long chunks, int failed) {}

    /** Builds the searchable corpus for one information row. */
    public String buildText(Information info) {
        StringBuilder sb = new StringBuilder();
        if (info.getTitle() != null && !info.getTitle().isBlank()) sb.append(info.getTitle().trim());
        try {
            InformationUnderstanding u = understandings.findByInformationId(info.getId()).orElse(null);
            if (u != null && u.getSummary() != null && !u.getSummary().isBlank()) {
                if (sb.length() > 0) sb.append("\n\n");
                sb.append(u.getSummary().trim());
            }
        } catch (Exception e) {
            log.debug("summary lookup failed information={} err={}", info.getId(), e.toString());
        }
        String body = (info.getContent() != null && !info.getContent().isBlank())
                ? info.getContent()
                : (info.getExcerpt() == null ? "" : info.getExcerpt());
        if (!body.isBlank()) {
            if (sb.length() > 0) sb.append("\n\n");
            sb.append(body.trim());
        }
        return sb.toString();
    }

    /**
     * Paragraph-aware fixed-size split with tail overlap.
     * Paragraphs accumulate up to maxChars; a single oversized paragraph is hard-split
     * at maxChars boundaries; consecutive chunks share the last {@code overlap} chars.
     */
    public List<String> split(String text) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isBlank()) return out;

        List<String> paragraphs = List.of(text.trim().split("\\n\\s*\\n"));
        StringBuilder current = new StringBuilder();
        for (String para : paragraphs) {
            String p = para.trim();
            if (p.isEmpty()) continue;
            if (current.length() == 0) {
                appendPiece(out, current, p);
            } else if (current.length() + 2 + p.length() <= maxChars) {
                current.append("\n\n").append(p);
            } else {
                out.add(current.toString());
                current.setLength(0);
                appendPiece(out, current, tailOverlap(out.get(out.size() - 1)) + p);
            }
        }
        if (current.length() > 0) out.add(current.toString());

        // oversize hard-split (single paragraph longer than maxChars)
        List<String> finalOut = new ArrayList<>();
        for (String chunk : out) {
            if (chunk.length() <= maxChars) {
                finalOut.add(chunk);
                continue;
            }
            int from = 0;
            while (from < chunk.length()) {
                int to = Math.min(from + maxChars, chunk.length());
                finalOut.add(chunk.substring(from, to));
                if (to == chunk.length()) break;
                from = to - overlap;
            }
        }
        return finalOut;
    }

    private void appendPiece(List<String> out, StringBuilder current, String piece) {
        if (piece.length() <= maxChars) {
            current.append(piece);
            return;
        }
        // oversized first paragraph → flush full chunks, keep tail in current
        int from = 0;
        while (from + maxChars < piece.length()) {
            out.add(piece.substring(from, from + maxChars));
            from = from + maxChars - overlap;
        }
        current.append(piece.substring(from));
    }

    private String tailOverlap(String s) {
        if (overlap == 0 || s.length() <= overlap) return "";
        return s.substring(s.length() - overlap) + "\n\n";
    }

    /** Chunks + embeds + persists one information row. Returns chunk count (0 = nothing searchable). */
    public int chunkInformation(Information info) {
        List<String> parts = split(buildText(info));
        if (parts.isEmpty()) {
            store.replace(info, List.of());
            return 0;
        }
        List<StoredChunk> rows = new ArrayList<>(parts.size());
        for (int i = 0; i < parts.size(); i++) {
            String content = parts.get(i);
            List<Double> vec = null;
            try {
                vec = embeddings.embed(content);
            } catch (Exception e) {
                log.warn("Embedding failed chunk of information={} err={} — storing without vector",
                        info.getId(), e.toString());
            }
            if (vec != null && vec.size() != embeddingDimensions) {
                throw new IllegalStateException("Embedding dim " + vec.size()
                        + " != " + embeddingDimensions + " (schema vector(" + embeddingDimensions
                        + ")) — check ai.embedding-dimensions / embedding provider config");
            }
            rows.add(new StoredChunk(i, content, embeddings.model(), vec));
        }
        store.replace(info, rows);
        return rows.size();
    }

    /** Hook for ingestion: chunk the freshly created rows; per-item isolation. */
    public int chunkIds(UUID userId, List<UUID> ids) {
        if (ids.isEmpty()) return 0;
        Map<UUID, Information> rows = information.findAllById(ids).stream()
                .filter(i -> userId.equals(i.getUserId()))
                .collect(java.util.stream.Collectors.toMap(Information::getId, i -> i));
        int ok = 0;
        for (UUID id : ids) {
            Information info = rows.get(id);
            if (info == null) continue;
            try {
                chunkInformation(info);
                ok++;
            } catch (Exception e) {
                log.warn("Chunking failed information={} err={}", id, e.toString());
            }
        }
        return ok;
    }

    /** Rebuild the whole corpus for one user (idempotent replace per information). */
    public ReindexResult reindex(UUID userId) {
        List<Information> all = information.findByUserId(userId);
        int chunked = 0, failed = 0;
        for (Information info : all) {
            try {
                chunkInformation(info);
                chunked++;
            } catch (Exception e) {
                failed++;
                log.warn("Reindex failed information={} err={}", info.getId(), e.toString());
            }
        }
        return new ReindexResult(all.size(), chunked, store.countByUser(userId), failed);
    }
}
