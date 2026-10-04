# Phase 5.0 — Baseline Check

## Current Architecture
```
Next.js 16 (App Router)  ──REST/JSON──▶  Spring Boot 4.1 (Java 21)
                                              │
                                  ┌───────────┴──────────┐
                               PostgreSQL 16          Redis 7 (infra)
```
- Frontend → Spring Boot only. No direct DB/Redis/AI access from browser.
- Business logic bound to no AI vendor (no AI SDK present).

## Phase 4 Status — FROZEN
Identity (JWT auth, profile, goals/interests/skills) + ingestion (RSS / GitHub public API / URL / File → exact dedup → Information → Inbox).

## Frontend Verification
- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — SUCCESS, 14 routes generated

## Backend Verification
- `mvnw clean package` — BUILD SUCCESS, jar produced
- **Tests run: 17, Failures: 0, Errors: 0**
  (Auth 4 · Goal IDOR 4 · Interest 2 · Ping MVC 1 · Hashing 2 · SSRF UrlValidator 4)

## Security Verification
- JWT env-based secret, BCrypt, hashed refresh rotation
- IDOR via findByIdAndUserId on goals/interests/skills/sources/information
- SSRF: loopback/private/metadata blocked; redirect hops re-validated
- XSS: zero dangerouslySetInnerHTML; Jsoup sanitization on stored content
- No AI/embedding/vector deps in pom.xml (grep clean)

## Regression Verification
- No code changed this phase (read-only baseline)
- Phase 2 motion / Phase 3 identity / Phase 4 ingestion all compile & test green

## Phase 4 Boundary Check
Confirmed ABSENT: LLM · Embedding · RAG · Signal Score · AI Summary · Semantic Dedup · Recommendation Engine.

## Phase 5 Starting Point
Ready to begin Information Understanding (language detection, classification, topic extraction, summary) on top of clean Information rows.

## Known Deferred Items
Docker/PostgreSQL/Redis runtime (no Docker on this machine) · live E2E · browser visual QA · DNS-rebinding hardening · scheduled auto-sync · OCR.

---
**PHASE 5.0 — BASELINE VERIFIED**
