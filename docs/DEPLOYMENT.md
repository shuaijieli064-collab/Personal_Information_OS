# SIGNAL — Deployment

## Local development

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Backend must run at `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`).
Override via env or `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Checks

| Command | Purpose |
|---|---|
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npx tsc --noEmit` | TypeScript typecheck |
| `npm test` | Vitest (jsdom) — auth refresh lifecycle, AuthGuard, UI primitives |
| `npm run build` | Production build (includes typecheck + static generation) |

CI (`.github/workflows/ci.yml`) runs backend `./mvnw -B verify` **and** frontend
lint → typecheck → test → build on every push/PR.

## Production — 4-container Docker stack (recommended)

The whole system ships as one compose file: **postgres (pgvector) + backend + frontend + caddy**
with automatic HTTPS, healthcheck-ordered startup, and the backend/db ports **never** exposed
to the public network. Verified budget: a single 2 vCPU / 2 GB RAM host (add 2 GB swap).

### Architecture in one picture

```
browser ──(80/443)──> caddy ──/api/*──> backend:8080 ──> postgres:5432
                        └──────────────> frontend:3000
```

`NEXT_PUBLIC_API_URL` is baked into the frontend at **build** time and is set to the
**caddy (public) origin** — not `backend:8080`. The browser therefore talks to exactly
one address; `/api/*` is reverse-proxied to the backend and everything else is Next.js.
Consequences: no CORS anywhere, and changing the public domain requires a frontend
image **rebuild** (it is a compile-time constant, not runtime env).

### One-time setup (from zero)

1. **Host prerequisites** (2 GB host): Docker Engine + compose plugin;
   swap is strongly recommended:

   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile \
     && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **Clone and configure**:

   ```bash
   git clone <repo> && cd SIGNAL
   cp .env.production.example .env.prod
   ```

   Fill `.env.prod`:
   - `SITE_ADDRESS` — your ONE public address. A domain (`https://signal.example.com`)
     gets automatic TLS from Let's Encrypt via Caddy; a bare `http://<ip>` serves
     plain HTTP for LAN-only use.
   - `DB_PASSWORD`, `JWT_SECRET` — generate with `openssl rand -base64 48`.
   - AI keys — chat / embedding / rerank may point at one provider (DashScope) or
     three different ones. Without any key, AI features degrade to deterministic
     mock/heuristic behaviour (verified in Phases 5–8) — the app still boots.

3. **Build and start** (first run pulls/builds for a few minutes):

   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
   docker compose --env-file .env.prod -f docker-compose.prod.yml ps
   ```

   Startup order is healthcheck-gated: postgres healthy → backend healthy →
   frontend started → caddy. Flyway applies V1–V24 to the empty database
   automatically at backend boot — **no manual migrations**.

4. **Verify (the "it actually landed" checklist)**:

   ```bash
   # Backend alive through caddy (401 envelope = Spring Security responding; actuator
   # deliberately has NO public route — only /api/* is proxied):
   curl -s http://localhost/api/v1/auth/me | grep 'UNAUTHORIZED'
   docker inspect --format="{{.State.Health.Status}}" $(docker compose --env-file .env.prod \
     -f docker-compose.prod.yml ps -q backend)     # expect: healthy
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost/    # frontend: 200
   ```

   Then in the browser, open `SITE_ADDRESS`: register → complete onboarding →
   Today renders → create an RSS source → sync → the inbox and Today feed fill.
   Without an AI key the understanding/summary fields show the deterministic
   fallbacks and signals stay below the 70 threshold (rule scoring on mock
   output); with keys, real summaries/embeddings/scores appear.

5. **DNS / TLS**: point the domain's A/AAAA record at the host. Caddy obtains and
   renews certificates automatically; no certbot, no manual renewal.

### Operations

| Task | Command |
|---|---|
| Logs | `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend` |
| Stop / start | `... down` / `... up -d` (data survives in volumes) |
| **Backup** | `./scripts/backup.sh` — consistent, gzipped, into `./backups/`, keeps 14 |
| **Restore** | `./scripts/restore.sh backups/signal-YYYYMMDD-HHMMSS.sql.gz` |
| Upgrade app | `git pull && ... up -d --build` (Flyway migrates the DB on boot) |
| cron daily backup | `30 3 * * * /opt/signal/scripts/backup.sh >> /opt/signal/backups/backup.log 2>&1` |

Memory on a 2 GB host: postgres ~300 MB (tuned in the compose file) · backend JVM
`-Xmx700m` (see `JAVA_OPTS` in `.env.production.example`) · frontend ~350 MB ·
caddy ~30 MB ≈ 1.5 GB working set. Raise any of it only after adding swap.
`-XX:+ExitOnOutOfMemoryError` makes the JVM die-and-restart instead of limping.

### Docker build details

- `backend/Dockerfile` — multi-stage: `maven:3.9-eclipse-temurin-21` builds the fat jar
  (dependency layer cached on `pom.xml`), runs as non-root on `eclipse-temurin:21-jre-alpine`,
  with an in-image `HEALTHCHECK` on `/actuator/health`.
- `frontend/Dockerfile` — pre-existing multi-stage build → Next.js **standalone** runner
  (`next.config.ts` sets `output: "standalone"`), `NEXT_PUBLIC_API_URL` as a build-arg.
- `deploy/Caddyfile` — `{$SITE_ADDRESS}` site block: `/api/*` → `backend:8080`,
  everything else → `frontend:3000`.

## Manual frontend build (no Docker)

```bash
npm run build
npm run start       # standalone server on :3000
```

On Vercel: set `NEXT_PUBLIC_API_URL` in project environment variables and
import the repo; framework preset (Next.js) is auto-detected. Note the backend
still has to be reachable publicly (it is a JVM + PostgreSQL service — host it
with the compose stack above).

## Architecture notes

- Tokens live in `localStorage` (`signal.access` / `signal.refresh`); the API
  client refreshes on 401 (single-flight) and broadcasts `signal:unauthorized`
  when the session is unrecoverable — `AuthGuard` then redirects to `/login`.
- Routes are grouped: `(auth)` = login/register, `(app)` = authenticated pages
  behind `AuthGuard` + `AppShell` (top navigation).
- i18n: `next-intl`, locales `zh-CN` (default) and `en`; messages in
  `frontend/messages/*.json`. Do not hardcode user-visible strings.

## 为什么不能发布到 WorkBuddy 云服务（2026-10-17 实测）

**结论：整站不可发布。** 实跑发布预检（`workbuddy_sites_deploy`，`directory` = 仓库根）返回
`{"type":"sites_deploy_unsupported","unsupportedKind":"external-service"}`，**没有发布任何内容**。
预检在上传前就会拒绝，因此不存在「发出去一半」的中间状态。

发布沙箱的模型是「一个目录 → 一个公网 HTTP 端口」，只提供 Node.js / Python / Go / 静态站点。
SIGNAL 是 2 个进程 + 2 个数据服务，命中三条独立阻断：

| # | 阻断 | 证据 |
|---|---|---|
| 1 | **后端是 Maven / Spring Boot**，沙箱没有 JVM | `backend/pom.xml`、`backend/src/main/resources/application.properties` |
| 2 | **PostgreSQL 16 + pgvector** 是检索核心，沙箱不提供数据库 | `docker-compose.yml` 用 `pgvector/pgvector:pg16`；17 个 Java 文件涉及 vector/embedding；`V13__knowledge_chunks.sql` 建 pgvector HNSW 索引 |
| 3 | ~~Redis~~ **查清后可以划掉** | 仅 `application.properties` 曾有 `spring.data.redis.*`，无任何 Java 代码引用，`pom.xml` 里也没有 redis starter —— 该配置已删除 |

### 三条可选路径与代价

1. **VPS / 任意能跑 Docker 的机器（推荐，本仓库已实现）**。`backend/Dockerfile` +
   `docker-compose.prod.yml` + `deploy/Caddyfile` + `.env.production.example` +
   `scripts/backup.sh`/`restore.sh` 已全部就位，见上文 Production 章节。这是唯一能
   完整保住 pgvector、调度器和 agent 的路。
2. **迁到 WorkBuddy 云 = 用云服务四模块（Database / Auth / Storage / LLM）重写后端**。
   pgvector 没有等价物，混合检索 + 重排要重新设计；调度器和 agent 的长任务在云服务里
   没有落点。本质是重写半个后端，不是「部署」。
3. **只发前端**。`frontend/Dockerfile` 就是单端口 standalone Node，技术上可发；但
   `NEXT_PUBLIC_API_URL` 默认 `http://localhost:8080`，线上访问不到后端，所有页面都是错误态。
   除非同时按路径 1 把后端部署到公网，否则单独发布没有意义。
