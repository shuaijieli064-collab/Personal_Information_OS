package com.signal.ai.tools;

import com.signal.ingestion.service.IngestionService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * WRITE — triggers the same ingestion sync as {@code POST /sources/{id}/sync}. It reaches
 * the network and writes new rows, so it is gated behind an explicit confirmation.
 */
@Component
public class SyncSourceTool implements AgentTool {

    private final IngestionService ingestion;

    public SyncSourceTool(IngestionService ingestion) {
        this.ingestion = ingestion;
    }

    @Override public String name() { return "syncSource"; }

    @Override public String description() {
        return "Synchronise one of the user's sources, fetching and storing new items.";
    }

    @Override public ToolPermission permission() { return ToolPermission.WRITE; }

    @Override public Map<String, String> parameters() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("sourceId", "the uuid of the source to synchronise");
        return p;
    }

    @Override public List<String> requiredParameters() { return List.of("sourceId"); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        UUID sourceId = ToolArgs.requiredUuid(args, "sourceId");

        IngestionService.SyncResult r = ingestion.sync(userId, sourceId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sourceId", r.sourceId());
        out.put("fetched", r.fetched());
        out.put("created", r.created());
        out.put("updated", r.updated());
        out.put("duplicates", r.duplicates());
        out.put("failed", r.failed());
        return out;
    }
}
