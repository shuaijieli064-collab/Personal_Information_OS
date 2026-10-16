package com.signal.ai.tools;

import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** READ — the caller's ranked signal feed. */
@Component
public class ListSignalsTool implements AgentTool {

    private final SignalRepository signals;

    public ListSignalsTool(SignalRepository signals) {
        this.signals = signals;
    }

    @Override public String name() { return "listSignals"; }

    @Override public String description() {
        return "List the user's signals, ranked by signal score.";
    }

    @Override public ToolPermission permission() { return ToolPermission.READ; }

    @Override public Map<String, String> parameters() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("limit", "maximum number of signals to return (default 20, max 100)");
        return p;
    }

    @Override public List<String> requiredParameters() { return List.of(); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        int limit = ToolArgs.optionalInt(args, "limit", 20, 1, 100);

        List<Signal> rows = signals
                .findByUserIdOrderBySignalScoreDesc(userId, PageRequest.of(0, limit))
                .getContent();

        List<Map<String, Object>> items = new ArrayList<>(rows.size());
        for (Signal s : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", s.getId());
            item.put("title", s.getTitle());
            item.put("signalScore", s.getSignalScore());
            item.put("status", s.getStatus());
            items.add(item);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", items.size());
        out.put("signals", items);
        return out;
    }
}
