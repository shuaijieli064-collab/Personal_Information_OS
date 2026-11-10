package com.signal.discover;

import com.signal.common.GlobalExceptionHandler;
import com.signal.discover.dto.DiscoverResult;
import com.signal.discover.dto.SuggestionDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.nullValue;

/** The suggest endpoint: validation, exact envelope shape, and user scoping. */
class DiscoverControllerTest {

    private final DiscoverService service = mock(DiscoverService.class);

    private final UUID userId = UUID.randomUUID();

    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new DiscoverController(service))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    DiscoverControllerTest() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, List.of()));
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void suggestReturnsTheEnvelopeShapeTheFrontendConsumes() throws Exception {
        when(service.suggest(eq(userId), eq("关注向量数据库"), eq(3)))
                .thenReturn(new DiscoverResult(
                        List.of(new SuggestionDto("pgvector Releases",
                                "https://github.com/pgvector/pgvector", "GITHUB",
                                "你正在补数据库知识，这个仓库 Release 直接相关")),
                        null));

        mvc.perform(post("/api/v1/discover/suggest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"关注向量数据库\",\"limit\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.suggestions[0].url").value("https://github.com/pgvector/pgvector"))
                .andExpect(jsonPath("$.data.suggestions[0].type").value("GITHUB"))
                .andExpect(jsonPath("$.data.fallback").value(nullValue()));
    }

    @Test
    void aBlankQueryIsAValidationFailure() throws Exception {
        mvc.perform(post("/api/v1/discover/suggest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void aTooLongQueryIsAValidationFailure() throws Exception {
        mvc.perform(post("/api/v1/discover/suggest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"" + "x".repeat(201) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void theFallbackFlagPassesThroughForTheFrontend() throws Exception {
        when(service.suggest(any(), any(), any()))
                .thenReturn(new DiscoverResult(List.of(), "manual"));

        mvc.perform(post("/api/v1/discover/suggest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"anything at all\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fallback").value("manual"));
    }
}
