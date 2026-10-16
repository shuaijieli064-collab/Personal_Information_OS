package com.signal.ai.tools;

import com.signal.ingestion.entity.Source;
import com.signal.ingestion.repository.SourceRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** READ — the caller's configured ingestion sources. */
@Component
public class ListSourcesTool implements AgentTool {

    private final SourceRepository sources;

    public ListSourcesTool(SourceRepository sources) {
        this.sources = sources;
    }

    @Override public String name() { return "listSources"; }

    @Override public String description() {
        return "List the user's ingestion sources (RSS, GitHub, URL, file).";
    }

    @Override public ToolPermission permission() { return ToolPermission.READ; }

    @Override public Map<String, String> parameters() { return new LinkedHashMap<>(); }

    @Override public List<String> requiredParameters() { return List.of(); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        List<Source> rows = sources.findAllByUserIdOrderByCreatedAtDesc(userId);

        List<Map<String, Object>> items = new ArrayList<>(rows.size());
        for (Source s : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", s.getId());
            item.put("name", s.getName());
            item.put("type", s.getType());
            item.put("url", s.getUrl());
            items.add(item);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", items.size());
        out.put("sources", items);
        return out;
    }
}
