package com.signal.ai.tools;

import com.signal.knowledge.KnowledgeAskService;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** READ — RAG answer from the caller's own corpus, with citations (Phase 6 K4). */
@Component
public class AskKnowledgeTool implements AgentTool {

    private final KnowledgeAskService ask;

    public AskKnowledgeTool(KnowledgeAskService ask) {
        this.ask = ask;
    }

    @Override public String name() { return "askKnowledge"; }

    @Override public String description() {
        return "Answer a question strictly from the user's own knowledge base, with citations.";
    }

    @Override public ToolPermission permission() { return ToolPermission.READ; }

    @Override public Map<String, String> parameters() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("question", "the question to answer from the knowledge base");
        return p;
    }

    @Override public List<String> requiredParameters() { return List.of("question"); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        String question = ToolArgs.requiredString(args, "question");

        KnowledgeAskService.AskResult result = ask.ask(userId, question, null, null, null);

        List<Map<String, Object>> citations = new ArrayList<>();
        for (KnowledgeAskService.Citation c : result.citations()) {
            Map<String, Object> citation = new LinkedHashMap<>();
            citation.put("index", c.index());
            citation.put("title", c.title());
            citation.put("url", c.url());
            citations.add(citation);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", result.status().name());
        out.put("answer", result.answer());
        out.put("citations", citations);
        return out;
    }
}
