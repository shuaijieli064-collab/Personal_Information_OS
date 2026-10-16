package com.signal.ai.tools;

import com.signal.knowledge.KnowledgeSearchService;
import com.signal.knowledge.ScoredChunk;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** READ — retrieval over the caller's own knowledge corpus (Phase 6 K3). */
@Component
public class SearchKnowledgeTool implements AgentTool {

    /** Keep each snippet short — the planner/answer step only needs the gist. */
    private static final int SNIPPET_CHARS = 240;

    private final KnowledgeSearchService search;

    public SearchKnowledgeTool(KnowledgeSearchService search) {
        this.search = search;
    }

    @Override public String name() { return "searchKnowledge"; }

    @Override public String description() {
        return "Search the user's own knowledge base for passages relevant to a query.";
    }

    @Override public ToolPermission permission() { return ToolPermission.READ; }

    @Override public Map<String, String> parameters() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("query", "the search query");
        p.put("limit", "maximum number of passages to return (default 10, max 50)");
        return p;
    }

    @Override public List<String> requiredParameters() { return List.of("query"); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        String query = ToolArgs.requiredString(args, "query");
        int limit = ToolArgs.optionalInt(args, "limit", 10, 1, 50);

        KnowledgeSearchService.SearchResult result =
                search.search(userId, query, KnowledgeSearchService.Mode.HYBRID, limit, null, null);

        List<Map<String, Object>> hits = new ArrayList<>();
        for (ScoredChunk c : result.results()) {
            Map<String, Object> hit = new LinkedHashMap<>();
            hit.put("title", c.title());
            hit.put("score", c.score());
            hit.put("snippet", snippet(c.content()));
            hits.add(hit);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", result.query());
        out.put("count", hits.size());
        out.put("results", hits);
        return out;
    }

    private static String snippet(String content) {
        if (content == null) return "";
        String text = content.trim();
        return text.length() <= SNIPPET_CHARS ? text : text.substring(0, SNIPPET_CHARS) + "…";
    }
}
