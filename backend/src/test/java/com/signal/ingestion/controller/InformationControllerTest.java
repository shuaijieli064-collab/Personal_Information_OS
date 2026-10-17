package com.signal.ingestion.controller;

import com.signal.common.GlobalExceptionHandler;
import com.signal.ingestion.entity.Information;
import com.signal.ingestion.repository.InformationRepository;
import com.signal.signal.entity.Signal;
import com.signal.signal.repository.SignalRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The inbox contract: triage decisions must survive a refresh, invalid states must be
 * rejected as 400 (not persisted, not 500), and the feed must say which rows already
 * became signals.
 */
class InformationControllerTest {

    private final InformationRepository repo = mock(InformationRepository.class);
    private final SignalRepository signals = mock(SignalRepository.class);

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new InformationController(repo, signals))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    private final UUID userId = UUID.randomUUID();

    private void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private Information info() {
        Information i = new Information();
        i.setId(UUID.randomUUID());
        i.setUserId(userId);
        i.setTitle("Raft 精读");
        i.setStatus("ACTIVE");
        return i;
    }

    @Test
    void keepPersistsTheDecision() throws Exception {
        authenticate();
        Information i = info();
        when(repo.findByIdAndUserId(i.getId(), userId)).thenReturn(Optional.of(i));
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));

        mockMvc.perform(patch("/api/v1/information/{id}", i.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"KEPT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("KEPT"));

        verify(repo).save(argThat(saved -> "KEPT".equals(saved.getStatus())));
    }

    @Test
    void ignorePersistsAsArchived() throws Exception {
        authenticate();
        Information i = info();
        when(repo.findByIdAndUserId(i.getId(), userId)).thenReturn(Optional.of(i));
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));

        mockMvc.perform(patch("/api/v1/information/{id}", i.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    @Test
    void unknownStatusIsRejectedWithoutPersisting() throws Exception {
        authenticate();
        Information i = info();
        when(repo.findByIdAndUserId(i.getId(), userId)).thenReturn(Optional.of(i));

        mockMvc.perform(patch("/api/v1/information/{id}", i.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"WHATEVER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        verify(repo, never()).save(any());
    }

    @Test
    void anotherUsersRowIsNotFound() throws Exception {
        authenticate();
        UUID foreign = UUID.randomUUID();
        when(repo.findByIdAndUserId(foreign, userId)).thenReturn(Optional.empty());

        mockMvc.perform(patch("/api/v1/information/{id}", foreign)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"KEPT\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void feedFiltersByStatusAndReportsExistingSignals() throws Exception {
        authenticate();
        Information i = info();
        when(repo.findByUserIdAndStatus(eq(userId), eq("ARCHIVED"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(i)));

        Signal s = new Signal();
        s.setId(UUID.randomUUID());
        s.setInformationId(i.getId());
        when(signals.findByInformationIdIn(any())).thenReturn(List.of(s));

        mockMvc.perform(get("/api/v1/information").param("status", "ARCHIVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].title").value("Raft 精读"))
                .andExpect(jsonPath("$.data.signalIds." + i.getId()).value(s.getId().toString()));

        verify(repo, never()).findByUserId(any(), any(PageRequest.class));
    }

    @Test
    void feedWithoutStatusIsUnfiltered() throws Exception {
        authenticate();
        when(repo.findByUserId(eq(userId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(info())));
        when(signals.findByInformationIdIn(any())).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/information"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1));

        verify(repo, never()).findByUserIdAndStatus(any(), any(), any());
    }
}
