package com.signal.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessExpirySec;
    private final long refreshExpirySec;

    public JwtService(
            @Value("${JWT_SECRET}") String secret,
            @Value("${JWT_ACCESS_EXPIRATION:900}") long accessExpirySec,
            @Value("${JWT_REFRESH_EXPIRATION:604800}") long refreshExpirySec) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("JWT_SECRET must be set (>=32 chars)");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirySec = accessExpirySec;
        this.refreshExpirySec = refreshExpirySec;
    }

    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    public String generateAccessToken(UUID userId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("typ", TYPE_ACCESS)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + accessExpirySec * 1000))
                .id(UUID.randomUUID().toString())
                .signWith(key)
                .compact();
    }

    /** Refresh token carries a fresh jti; only its hash is stored. */
    public String generateRefreshToken(UUID userId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("typ", TYPE_REFRESH)
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + refreshExpirySec * 1000))
                .signWith(key)
                .compact();
    }

    /**
     * Parses a token and rejects it unless it is an ACCESS token.
     * A refresh token must never authenticate a protected endpoint.
     */
    public UUID parseAccessToken(String token) {
        return parseTyped(token, TYPE_ACCESS);
    }

    /** Parses a token and rejects it unless it is a REFRESH token. */
    public UUID parseRefreshToken(String token) {
        return parseTyped(token, TYPE_REFRESH);
    }

    private UUID parseTyped(String token, String expectedType) {
        Claims c = parse(token);
        String typ = c.get("typ", String.class);
        if (!expectedType.equals(typ)) {
            throw new io.jsonwebtoken.JwtException("wrong token type: expected " + expectedType);
        }
        return UUID.fromString(c.getSubject());
    }

    private Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
    }

    public String jti(String token) {
        return parse(token).getId();
    }

    /** Configured refresh lifetime in seconds — keeps DB expiry in sync with the JWT. */
    public long refreshExpirySeconds() {
        return refreshExpirySec;
    }
}
