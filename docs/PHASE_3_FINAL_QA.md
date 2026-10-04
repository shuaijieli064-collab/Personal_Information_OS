# Phase 3 Final QA Report

## Implemented
- Auth: register / login / refresh (rotation) / logout / me
- User identity: User + UserProfile (1:1), BCrypt hashing, JWT access + hashed refresh
- Personal context: Goals / Interests / Skills full CRUD, user-isolated
- Unified response envelope + `@RestControllerAdvice`
- Frontend: api client, /login, /register, /onboarding, /today placeholder, /settings/profile, /settings/security

## Passed
- `npm run lint` — 0 problems
- `npm run build` — TS clean, 9 routes static
- `mvnw clean package` — BUILD SUCCESS, jar produced
- **Tests run: 11, Failures: 0, Errors: 0**

## Fixed
- Spring Security 8 (Boot 4.1) removed `UsernamePasswordAuthenticationFilter` → anchored JWT filter before `AuthorizationFilter`
- Boot 4 test slice package path
- IDOR: all resource reads go through `findByIdAndUserId`
- Interest normalization: `AI / ai / Ai` collapse via normalized_name unique

## Runtime Verified
- Unit/service tests (real execution): auth happy/duplicate/wrong-password/disabled, goal IDOR read/delete, interest normalization
- Ping MVC slice test with security chain

## Not Runtime Verified
- **Docker**: still not installed on this machine → PG/Redis/Flyway over real sockets NOT RUN
- **Full HTTP flow**: register→login→refresh→me→CRUD over the running app NOT verified (needs DB)
- Browser visual QA at 1440/1024/768/390 not executed

## Authentication QA
register ✓ · login ✓ · refresh rotation ✓ (old jti revoked) · logout revokes ✓ · me ✓ (no secrets in payload)

## Authorization QA
Service-layer tests prove: User A reading/deleting User B goal → ResourceNotFoundException (404); all repos use `findByIdAndUserId`.

## Database QA
V2__identity.sql reviewed: FK + ON DELETE CASCADE on user-owned tables, UNIQUE(user_id, normalized_name), CHECK constraints, timestamptz, UUID. **Not runtime-migrated.**

## API QA
Envelope `{success,data}` / `{success:false,error:{code,message}}` consistent; no stack traces leaked.

## Frontend QA
Dark minimal auth pages, BlurReveal only, no particles/gradients; single api client (no scattered fetch).

## Responsive QA
Code-review: single-column forms max-w-sm/md; no overflow risks. Not device-tested.

## Security QA
- password = BCrypt; JWT_SECRET from env, no default in code
- refresh stored as SHA-256 hash + jti, rotation + revocation
- no secrets hardcoded (grep clean); .env not present
- endpoints: only ping/register/login/refresh/health anonymous

## Performance QA
No N+1 (simple findAll per user); no unbounded eager loading.

## Tests
11 green: AuthServiceTest(4) · GoalServiceTest(4) · InterestServiceTest(2) · PingControllerTest(1)

## Remaining Issues
1. No Docker → full-stack e2e unverified
2. Rate limiting on auth endpoints — **Deferred** (needs Redis live; recorded)
3. Mockito self-attach warning on JDK 25

## Deferred Items
Rate limiting · Change password · Connected sources · Data export

## Phase 3 Status

**PHASE 3 — FROZEN**
