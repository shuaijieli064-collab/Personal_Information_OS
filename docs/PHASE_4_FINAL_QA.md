# Phase 4 Final QA Report

## Phase Status
Phase 4 implementation + final hardening complete. Runtime items honestly marked NOT RUNTIME VERIFIED.

## Implemented
- V3 migration (sources lifecycle columns, `information` table with provenance)
- Unified ingestion: SourceCollector (RSS / GitHub public API / URL / File), NormalizedItem, IngestionPersister
- RSS (ROME), GitHub releases/issues/PRs, URL import (Jsoup), TXT/MD/PDF (PDFBox)
- Exact dedup, source CRUD+sync, paged information list/detail, /import/url, /import/file
- Frontend /sources /inbox /inbox/[id]

## Passed
- Frontend lint: 0 errors, 0 warnings
- Frontend build: TS clean, 14 routes static
- Backend `mvnw clean package`: BUILD SUCCESS
- Tests: **17 run, 0 failures, 0 errors**

## Fixed (during this QA)
- **Redirect SSRF hardening**: HttpClient switched to manual redirect following; every redirect hop re-validated (scheme + DNS-resolved IP) — public→localhost/private/metadata now blocked, max 5 hops
- Restored /sources page after a stray regex edit (rebuilt cleanly)

## Runtime Verified
- Unit-level: SSRF blocks loopback / 10.0.0.0/8 / 172.16/12 / 192.168/16 / 169.254.169.254 / file: / javascript:
- Hashing + canonical URL deterministic
- All Phase 3 auth + IDOR tests still green (no regression)
- Pagination enforcement in code: size clamped to max 100 in controller
- Transaction boundary by design: network in IngestionService, DB writes isolated in @Transactional IngestionPersister
- XSS: frontend contains zero `dangerouslySetInnerHTML`/`innerHTML`; stored content sanitized with Jsoup Safelist.none()

## Not Runtime Verified
- Docker runtime — NOT VERIFIED (Docker not installed on this machine)
- PostgreSQL / Redis / Flyway V1–V3 over real sockets — NOT VERIFIED
- Spring Boot live HTTP → NOT VERIFIED (ping validated by MockMvc only)
- Real RSS E2E, GitHub E2E, URL E2E, file upload E2E — NOT VERIFIED
- Duplicate-sync behavior against a real DB — NOT VERIFIED (keys designed, not exercised live)
- Browser visual QA at 1440/1024/768/390 — NOT VERIFIED
- Redirect→localhost end-to-end over the wire — NOT VERIFIED (logic implemented; needs a live redirect server)

## RSS E2E
NOT RUNTIME VERIFIED. ROME parser wired for RSS 2.0 + Atom; normalizes title/clean-text/author/publishedAt; errors map to SOURCE_SYNC_FAILED without stack traces.

## GitHub E2E
NOT RUNTIME VERIFIED. Public api.github.com only; stable external IDs release:/issue:/pull:; PRs filtered from issues; max-items env-configured.

## URL Import E2E
NOT RUNTIME VERIFIED. SSRF + scheme whitelist + size cap wired; Jsoup article/body extraction.

## File Import E2E
NOT RUNTIME VERIFIED. txt/md/pdf allowed, ≤10MB, scanned PDF → explicit error (no OCR).

## Deduplication QA
By design: `(source_id, sha256(externalId/canonicalUrl))` + `source_item_id UNIQUE`. Live re-sync NOT RUN.

## Provenance QA
By design: every Information keeps source_id, source_item_id, url. Live trace NOT RUN.

## Authorization / IDOR QA
Unit-tested in Phase 3 (cross-user → 404); same `findByIdAndUserId` pattern applied to sources/information. Live User A/B matrix NOT RUN.

## SSRF QA
PASSED (unit): loopback, private ranges, metadata endpoint, non-HTTP schemes all rejected.

## Redirect SSRF QA
HARDENED this QA round: per-hop revalidation implemented. Live redirect-to-localhost test NOT RUN.

## XSS QA
PASSED by inspection: no raw HTML rendering in frontend; Jsoup strips scripts/onerror from stored text.

## File Security QA
Extension whitelist + size cap + PDF parse failure handled. Live malicious upload NOT RUN.

## Database QA
V3 reviewed: FK, UNIQUE, CHECK, JSONB, timestamptz. Live Flyway apply NOT VERIFIED.

## Transaction Boundary QA
PASSED by inspection: fetch/parse outside tx, persist in separate @Transactional bean.

## API QA
Unified envelope; unauthorized business endpoints require JWT (SecurityConfig anyRequest authenticated); errors generic.

## Frontend QA
Build/lint green; real API-driven (no fake stats); empty/loading/error states present.

## Browser QA
NOT VERIFIED.

## Responsive QA
NOT VERIFIED (single-column layouts, no fixed widths by design).

## Motion Regression QA
Phase 2 motion files untouched by Phase 4; /motion-demo and /intro routes still build. Visual regression NOT RE-RUN.

## Performance QA
Pagination bounded (≤100), no N+1 in reads, HTTP bounded + never inside tx.

## Dependency QA
Added ROME 2.1.0 / Jsoup 1.18.3 / PDFBox 3.0.3 — all directly used. npm audit / mvn tree NOT RUN this round.

## CI QA
GitHub Actions file present (per Phase 2); Linux CI execution NOT locally verified.

## Documentation QA
docs/INGESTION.md + docs/API.md updated to match implementation.

## Remaining Issues
No open hard blockers. Known unit-test warning: Mockito self-attaching on JDK 25 (non-blocking).

## Deferred Items
DNS-rebinding resolve→connect hardening · live Docker/DB runtime · browser visual QA · scheduled auto-sync · distributed per-source lock · OCR · semantic dedup (Phase 5).

## Phase 4 Status

**PHASE 4 — FROZEN**
