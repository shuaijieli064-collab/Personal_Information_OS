# Runtime Verification — P0 Hardening (H5) + Phase 5.5 S4–S5

> Rule: every line is backed by a command that actually ran in this environment.
> Anything not executed stays **NOT VERIFIED** — never "should work".

Environment: Windows 11 · Docker 29.8.1 (`signal-postgres` = pgvector/pgvector:pg16 on 5432,
`signal-redis` = redis:7-alpine on 6379) · JDK 25 (runs Java 21 target) · Node 24.
Verification backend: `signal-0.0.1-SNAPSHOT.jar`, `AI_API_KEY=` (empty → **MockAIProvider**),
`DB_URL=...signal_flyway_check` (database rebuilt from scratch).

| # | Check | Method | Result |
|---|---|---|---|
| 1 | Backend unit/integration tests | `./mvnw -B verify` (2026-10-07) | ✅ 55 run, 0 failures |
| 2 | Frontend lint / tsc / vitest / build | `npm run lint` · `npx tsc --noEmit` · `npx vitest run` · `npm run build` (2026-10-07, final S4 run) | ✅ 0 errors / 0 warnings · clean · 16/16 (3 files) · build 0 |
| 3 | Empty-DB migration V1→V11 | fresh `signal_flyway_check`, Flyway on boot | ✅ `Successfully applied 11 migrations … now at version v11` |
| 4 | Hibernate `ddl-auto=validate` on fresh DB | same boot (failed pre-V12: `missing column created_at in goals`) | ✅ after `V12__jpa_schema_alignment` — startup proceeds past EMF creation |
| 5 | Full boot on fresh DB | jar start, Mock AI | ✅ `Started SignalApplication` + `GET /api/v1/ping` → `{"success":true,...}` |
| 6 | No secrets packaged in jar | zip listing of `BOOT-INF` after rebuild | ✅ 0 `.env` entries (`resources/.env` deleted) |
| 7 | Secrets not tracked | `git ls-files` + pattern grep | ✅ only `.env.example`; no key matches |
| 8 | **Full E2E API walk** | `scripts/e2e-smoke.ps1` vs running jar (fresh DB, Mock AI) | ✅ **29 PASS / 0 FAIL / 0 WARN** (2026-10-07): register→login→refresh rotation→profile/goals/interests/skills→file import→understanding (COMPLETED, relevance=70, score=73.3 ≥70 → Signal created)→classify→signal detail/save→feedback→today (info=1 signals=1)→RSS source create/sync/delete (live hnrss.org)→IDOR 404→anon 401→logout revoke + refresh rejected |
| 9 | Bugs found & fixed by E2E | — | ✅ `SignalGenerationService.generate` now idempotent (re-running understanding on an item that already has a Signal no longer 500s); feedback API contract corrected in `docs/API.md` (`{type: USEFUL…}`) |
| 10 | Infra resilience | Docker Desktop engine stopped mid-session; containers exited; restarted via `docker compose up -d` | ✅ `signal-pgdata` volume survived, flyway history intact, HikariCP reconnected without restart |

## Phase 5.5 S4 — Browser walkthrough (direction A, 2026-10-07)

Tool: gstack browse (headless Chromium, 1440x900 unless noted) against `next dev` :3000
(proxying to the same verification jar :8080).

| # | Check | Method | Result |
|---|---|---|---|
| 11 | Route walk — all pages render | `$B chain` (goto → wait h1 → js) over 16 routes: `/zh-CN` landing, login, register, today, inbox, sources, discover, knowledge, ai, activity, onboarding, settings/profile, settings/security, `/en`, `/en/today`, `/zh-CN/inbox/{id}` | ✅ every route 200 with correct localized h1 (e.g. 信息无限。注意力有限。/ 把互联网的噪声折叠成你的信号 / 晚上好。/ Good evening. / detail title) |
| 12 | Console clean across walk | `console --clear` → full walk → `console --errors` | ✅ 0 errors (after `useDiscover` stopped probing the planned `/api/v1/discover` — it was producing a 500 per visit; page now serves the documented local fallback) |
| 13 | Direction-A tokens live | `getComputedStyle` spot checks | ✅ today h1 = Space Grotesk, stat = 56px JetBrains Mono in `#8B85FF`, body bg `#0C0F14`, `.shadow-card` = `0 24px 60px -20px rgba(0,0,0,.55)`; login shell radius `28px`, inputs bg `#0C0F14`; landing h1 76px with `bg-clip-text` gradient `signal→signal-2`, hero CTA shadow `0 18px 46px -14px rgba(139,133,255,.3)` |
| 14 | Shell & nav | computed + DOM | ✅ sidebar gradient wordmark (Space Grotesk) + live dot (`animate-signal-pulse`); active nav `animationName: signal-pulse`; @375px: mobile top bar (gradient SIGNAL + pulse dot) + bottom nav both present |
| 15 | Inbox with real data | UI-created source synced live (`hnrss.org`, fetched=20 created=20; retries duplicates=20) | ✅ 20 rows; freshness dot `rgb(63,203,134)` (≤24h); meta row JetBrains Mono `ARTICLE · 2026/10/7`; excerpt tier line; group header 12px uppercase + mono count pill `20` |
| 16 | Sources featured layout | DOM after create | ✅ hero card: icon plate `rgba(139,133,255,.14)`, status pill `已连接` (mono uppercase, success border); sync mid-state pill `同步中` + `.animate-spin`; error path also observed (`Unable to synchronize source.` inline — backend `HTTP connect timed out`, env network flakiness, retried OK) |
| 17 | Onboarding stepper | step-through via clicks + native-setter input injection | ✅ `步骤 1/3 → 2/3 → 3/3`; segment colors active `#8B85FF` / done `signal-dim` / todo `#242B36`; tag chip pill `bg rgba(139,133,255,.14)`; buttons 上一步/下一步/完成设置/跳过 |
| 18 | Settings two-column | DOM | ✅ grid `208px 728px`; rail group label 设置, active link `aria-current=page` + signal-pulse; cards 账户/偏好/会话 with `shadow-card`; security logout button renders |
| 19 | Detail page | click 首行「生成信号」→ `/inbox/{id}` | ✅ h1 = item title, article body, type eyebrow; console 0 errors |
| 20 | Contrast (computed from token hex) | WCAG ratio script | ✅ ink-3 `#8A97A8` 5.57 (card) / 6.46 (page) / 4.80 (panel); ink-2 9.18; ink-1 15.27; signal 5.43; signal-2 8.16; success 7.96; danger 6.31; warning 7.67 — all ≥4.5:1 |
| 21 | Focus indicators | `:focus-visible` states via `element.focus()` | ✅ links & raw buttons: `outline solid 2px rgb(139,133,255)` offset 2px (globals `@layer base` rule, no double-ring — inputs stay `outline-none` + ring-signal/25 + glow; Button keeps focus-visible ring /40); login Tab order: email → password → 登录 → 创建账号 → locale |
| 22 | Reduced motion | `@media (prefers-reduced-motion)` clamp in globals + CountUp unit test | ✅ animation-duration clamped to 0.01ms (signal-pulse settles static); CountUp jumps to final value (vitest) |

## Phase 5.5 S5 — Responsive + state screenshots (2026-10-07)

| # | Check | Method | Result |
|---|---|---|---|
| 23 | Responsive overflow walk | `$B chain`: `viewport` 1024x800 / 768x1024 / 390x844 × 6 pages (landing, login, today, inbox, sources, settings/profile), each `goto → wait h1 → js scrollWidth check → screenshot` | ✅ **18/18 no horizontal overflow** (`scrollWidth == innerWidth` everywhere); breakpoints verified by computed style: ≥768 → aside `display:flex` 224px + mobile header/bottom-nav `display:none`; <768 → aside gone + gradient top bar + bottom nav present; screenshots in `ui-design-runs/s5-shots/{page}-{width}.png` |
| 24 | State capture (loading / empty / error / auth error) | In-page `fetch` patches (delay 10s / reject for `GET /api`, SPA-only so tokens+nav survive) + temp account **B** (`s5qa-…@signal.test`): register → onboarding → skip → today; login page fed wrong password | ✅ 8 shots: `today-loading` (4 `.animate-pulse` skeletons on `/today`), `today/inbox/sources-empty` (account B zero-data), `today/inbox/sources-error` (refetch rejected → inline danger copy), `login-error` (`Email or password is incorrect`); patch removal → navigate → **recovery confirmed** (error gone, data loads) |
| 25 | Session restored after QA | saved account **A** `signal.access/refresh` → ran state flows as B → `localStorage.setItem` A tokens + reload | ✅ inbox back to **20 rows** (A's real RSS data); no residual patches (`window.fetch` restored) |

Board: `ui-design-runs/s5-board.html` (26 screenshots, grouped Responsive / States) — `ui-design-runs/` is gitignored, local review artifact.

## NOT VERIFIED yet

- Cross-browser (Firefox/WebKit) and screen-reader pass
- Live AI provider responses (Mock only, per verification scope)
- Scheduled sync / notifications (Phase 8 scope)

---
Filled incrementally by P0 Hardening; browser walkthrough appended at Phase 5.5 S4; responsive + state screenshot pass appended at Phase 5.5 S5; finalized at Phase 5.5 freeze.
