package com.signal.config;

import com.signal.common.ApiResponse;
import com.signal.security.JwtAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

import java.io.IOException;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper json = new ObjectMapper();

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/ping",
                                "/api/v1/auth/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh",
                                "/actuator/health").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(unauthorized())
                        .accessDeniedHandler(forbidden()))
                .addFilterBefore(jwtAuthFilter, AuthorizationFilter.class);
        return http.build();
    }

    /**
     * Spring Security's defaults answer with an empty 403, which leaves the client
     * parsing a non-JSON body. Both handlers speak the same envelope as every controller.
     */
    private AuthenticationEntryPoint unauthorized() {
        return (req, res, e) -> write(res, HttpServletResponse.SC_UNAUTHORIZED,
                "UNAUTHORIZED", "Authentication required.");
    }

    private AccessDeniedHandler forbidden() {
        return (req, res, e) -> write(res, HttpServletResponse.SC_FORBIDDEN,
                "FORBIDDEN", "Access denied.");
    }

    private void write(HttpServletResponse res, int status, String code, String message) {
        try {
            res.setStatus(status);
            res.setContentType("application/json");
            res.setCharacterEncoding("UTF-8");
            res.getWriter().write(json.writeValueAsString(ApiResponse.fail(code, message)));
        } catch (IOException ignored) {
            // response already committed — nothing left to do
        }
    }
}
