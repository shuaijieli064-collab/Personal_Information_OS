# Phase 5 Final QA Report

## Architecture
Next.js → REST → Spring Boot → PostgreSQL/Redis. AI behind vendor-agnostic `AIProvider`; business code never imports a specific vendor SDK.

## AI Provider
- OpenAICompatibleProvider: env-configured baseUrl/model/apiKey, bounded timeout, max 2 retries, no secret logging.
- Mock fallback when no key.
- **NOT RUNTIME VERIFIED** against a live endpoint.

## Classification
10-class enum + confidence validation; invalid/out-of-range → FAILED. Unit-tested (normal / bad enum / malformed JSON / confidence out of range).

## Topics / Entities
Topics ≤10 (case-insensitive dedup), entities ≤20 with kind whitelist. Unit-tested.

## Summary
JSON `{summary, keyPoints[]}`, length + keypoint guards; FAILED on violation. No fabricated summary.

## Semantic Dedup
pgvector schema (V7) + EmbeddingProvider abstraction + cosine threshold (config `DEDUP_THRESHOLD=0.85`). Information immutable; cluster is a logical link. **Live vector similarity NOT RUNTIME VERIFIED** (no pgvector/PG in this env).

## Relevance
Goal/Interest keyword match → relevance_score + why_relevant. Unit-tested.

## Signal Score
Pure deterministic weighted calculator; unit-tested all-100 / all-0 / mixed.

## Signal Generation
Threshold `app.signal.min-score=70` (config); below → no Signal; unique information_id. Unit-tested.

## Signal API
List (size≤100, score DESC), get/patch/save/ignore/important; IDOR via findByIdAndUserId.

## Today UI
`/api/v1/today` returns real counts + signals; frontend renders stats + Signal Cards with BlurReveal stagger. No hardcoded numbers.

## Feedback
`user_feedback` upsert per (user, signal); 5 types; IDOR-protected.

## Security
- IDOR: all resource lookups scoped by user.
- Prompt injection: external content always wrapped as UNTRUSTED_CONTENT via PromptBoundary.
- SSRF/XSS: Phase 4 guards intact; frontend has zero dangerouslySetInnerHTML.
- No hardcoded secrets; API key from env only.

## Performance
Pagination everywhere; no unbounded N+1 by inspection; AI calls bounded + never inside DB transaction.

## Regression
Phase 2 motion files untouched; frontend still builds; all prior 24 tests still green.

## Tests
**51 run, 0 failures, 0 errors.**

## Runtime Verified
- Backend unit tests (51) — PASS
- Frontend lint/build — PASS

## Not Runtime Verified
- PostgreSQL / pgvector / Flyway V1–V11 — NOT VERIFIED (no Docker on this machine)
- Live AI provider / embeddings / real classification quality — NOT VERIFIED
- Browser visual QA at 1440/1024/768/390 — NOT VERIFIED

## Deferred
RAG / Knowledge Graph / Agent / Email / Browser Extension / OCR / scheduled sync / DNS-rebinding hardening.

## Known Issues
Mockito self-attaching JDK25 warning (non-blocking).

---
**PHASE 5 — FROZEN**
