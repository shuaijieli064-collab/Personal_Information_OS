package com.signal;

import com.signal.config.SecurityConfig;
import com.signal.security.JwtAuthFilter;
import com.signal.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(com.signal.common.PingController.class)
@Import({PingControllerTest.TestJwtConfig.class, SecurityConfig.class, JwtAuthFilter.class})
class PingControllerTest {

    @TestConfiguration
    static class TestJwtConfig {
        @Bean
        JwtService jwtService() {
            return new JwtService("test-secret-key-that-is-long-enough-32ch!!", 900, 604800);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void pingReturnsSuccessEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").value("pong from SIGNAL backend"));
    }
}
