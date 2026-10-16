package com.signal.ai.tools;

import com.signal.common.exceptions.ResourceNotFoundException;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * WRITE — archives one of the caller's information rows (the {@code status} column from
 * {@code V15__information_status.sql}). An id owned by another user resolves to "not found".
 */
@Component
public class ArchiveInformationTool implements AgentTool {

    private final InformationRepository information;

    public ArchiveInformationTool(InformationRepository information) {
        this.information = information;
    }

    @Override public String name() { return "archiveInformation"; }

    @Override public String description() {
        return "Archive one of the user's information items so it leaves the active feed.";
    }

    @Override public ToolPermission permission() { return ToolPermission.WRITE; }

    @Override public Map<String, String> parameters() {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("informationId", "the uuid of the information item to archive");
        return p;
    }

    @Override public List<String> requiredParameters() { return List.of("informationId"); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        UUID informationId = ToolArgs.requiredUuid(args, "informationId");

        Information info = information.findByIdAndUserId(informationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Information not found"));

        info.setStatus("ARCHIVED");
        info.setUpdatedAt(Instant.now());
        information.save(info);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", info.getId());
        out.put("status", info.getStatus());
        return out;
    }
}
