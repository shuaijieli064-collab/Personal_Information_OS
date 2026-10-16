package com.signal.ai.tools;

import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.repository.SignalRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * READ — the same headline counts the "Today" dashboard exposes
 * ({@code TodayController}): how much information the caller has, how many signals were
 * derived, and how many need action.
 */
@Component
public class TodaySummaryTool implements AgentTool {

    /** Matches TodayController's window for counting action-required signals. */
    private static final int SIGNAL_WINDOW = 100;

    private final InformationRepository information;
    private final SignalRepository signals;

    public TodaySummaryTool(InformationRepository information, SignalRepository signals) {
        this.information = information;
        this.signals = signals;
    }

    @Override public String name() { return "todaySummary"; }

    @Override public String description() {
        return "Summarise the user's current day: information count, signal count and how many need action.";
    }

    @Override public ToolPermission permission() { return ToolPermission.READ; }

    @Override public Map<String, String> parameters() { return new LinkedHashMap<>(); }

    @Override public List<String> requiredParameters() { return List.of(); }

    @Override
    public Object execute(UUID userId, Map<String, Object> args) {
        long informationCount = information.findByUserId(userId, PageRequest.of(0, 1)).getTotalElements();
        var signalPage = signals.findByUserIdOrderBySignalScoreDesc(userId, PageRequest.of(0, SIGNAL_WINDOW));
        long actionRequired = signalPage.getContent().stream()
                .filter(s -> "IMPORTANT".equals(s.getStatus()))
                .count();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("informationCount", informationCount);
        out.put("signalCount", signalPage.getTotalElements());
        out.put("actionRequired", actionRequired);
        return out;
    }
}
