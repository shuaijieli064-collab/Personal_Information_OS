package com.signal.auth;

import com.signal.auth.dto.LoginRequest;
import com.signal.auth.dto.RegisterRequest;
import com.signal.auth.repository.RefreshTokenRepository;
import com.signal.auth.service.AuthService;
import com.signal.common.exceptions.DuplicateResourceException;
import com.signal.security.JwtService;
import com.signal.user.entity.User;
import com.signal.user.repository.UserProfileRepository;
import com.signal.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceTest {

    UserRepository users = mock(UserRepository.class);
    UserProfileRepository profiles = mock(UserProfileRepository.class);
    RefreshTokenRepository refreshTokens = mock(RefreshTokenRepository.class);
    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    JwtService jwt = new JwtService("test-secret-key-that-is-long-enough-32ch!!", 900, 604800);
    AuthService service;

    @BeforeEach
    void setup() {
        service = new AuthService(users, profiles, refreshTokens, encoder, jwt);
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(users.existsByEmail("a@b.com")).thenReturn(true);
        assertThrows(DuplicateResourceException.class,
                () -> service.register(new RegisterRequest("A@b.com", "longpassword1", null)));
    }

    @Test
    void registerHashesPasswordAndLowercasesEmail() {
        when(users.existsByEmail(any())).thenReturn(false);
        when(users.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });
        var resp = service.register(new RegisterRequest("  User@Example.COM  ", "longpassword1", "Me"));
        assertNotNull(resp.accessToken());
        verify(users).save(argThat(u ->
                u.getEmail().equals("user@example.com")
                && encoder.matches("longpassword1", u.getPasswordHash())));
    }

    @Test
    void loginRejectsWrongPassword() {
        User u = new User();
        u.setEmail("a@b.com");
        u.setPasswordHash(encoder.encode("right-password"));
        when(users.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        assertThrows(BadCredentialsException.class,
                () -> service.login(new LoginRequest("a@b.com", "wrong")));
    }

    @Test
    void loginRejectsDisabledUser() {
        User u = new User();
        u.setEmail("a@b.com");
        u.setPasswordHash(encoder.encode("right-password"));
        u.setStatus("DISABLED");
        when(users.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        assertThrows(BadCredentialsException.class,
                () -> service.login(new LoginRequest("a@b.com", "right-password")));
    }
}
