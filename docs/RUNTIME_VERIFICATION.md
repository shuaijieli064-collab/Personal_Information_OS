# Runtime Verification — P0 Hardening (H5)

> Rule: every line is backed by a command that actually ran in this environment.
> Anything not executed stays **NOT VERIFIED** — never "should work".

Environment: Windows 11 · Docker 29.8.1 (`signal-postgres` = pgvector/pgvector:pg16 on 5432,
`signal-redis` = redis:7-alpine on 6379) · JDK 25 (runs Java 21 target) · Node 24.
Verification backend: `signal-0.0.1-SNAPSHOT.jar`, `AI_API_KEY=` (empty → **MockAIProvider**),
`DB_URL=...signal_flyway_check` (database rebuilt from scratch).

| # | Check | Method | Result |
|---|---|---|---|
| 1 | Backend unit/integration tests | `./mvnw -B verify` (2026-10-07) | ✅ 55 run, 0 failures |
| 2 | Frontend lint / tsc / vitest / build | `npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run build` | ✅ 0 errors (1 pre-existing warning, fixed in H6) · clean · 10/10 · 18 routes built |
| 3 | Empty-DB migration V1→V11 | fresh `signal_flyway_check`, Flyway on boot | ✅ `Successfully applied 11 migrations … now at version v11` |
| 4 | Hibernate `ddl-auto=validate` on fresh DB | same boot (failed pre-V12: `missing column created_at in goals`) | ✅ after `V12__jpa_schema_alignment` — startup proceeds past EMF creation |
| 5 | Full boot on fresh DB | jar start, Mock AI | ✅ `Started SignalApplication` + `GET /api/v1/ping` → `{"success":true,...}` |
| 6 | No secrets packaged in jar | zip listing of `BOOT-INF` after rebuild | ✅ 0 `.env` entries (`resources/.env` deleted) |
| 7 | Secrets not tracked | `git ls-files` + pattern grep | ✅ only `.env.example`; no key matches |
| 8 | **Full E2E API walk** | `scripts/e2e-smoke.ps1` vs running jar (fresh DB, Mock AI) | ✅ **29 PASS / 0 FAIL / 0 WARN** (2026-10-07): register→login→refresh rotation→profile/goals/interests/skills→file import→understanding (COMPLETED, relevance=70, score=73.3 ≥70 → Signal created)→classify→signal detail/save→feedback→today (info=1 signals=1)→RSS source create/sync/delete (live hnrss.org)→IDOR 404→anon 401→logout revoke + refresh rejected |
| 9 | Bugs found & fixed by E2E | — | ✅ `SignalGenerationService.generate` now idempotent (re-running understanding on an item that already has a Signal no longer 500s); feedback API contract corrected in `docs/API.md` (`{type: USEFUL…}`) |
| 10 | Infra resilience | Docker Desktop engine stopped mid-session; containers exited; restarted via `docker compose up -d` | ✅ `signal-pgdata` volume survived, flyway history intact, HikariCP reconnected without restart |

## NOT VERIFIED yet

- Browser visual QA (1440/1024/768/390) — Phase 5.5 S5 (combined with H5 browser walkthrough)
- Live AI provider responses (Mock only, per verification scope)
- Scheduled sync / notifications (Phase 8 scope)

---
Filled incrementally by P0 Hardening; finalized at Phase 5.5 freeze.
