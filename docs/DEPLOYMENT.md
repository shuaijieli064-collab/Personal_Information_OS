# SIGNAL — Frontend Deployment

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

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every push/PR.

## Production

### Docker (recommended)

```bash
docker build -t signal-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  frontend/
docker run -p 3000:3000 signal-frontend
```

Multi-stage build (deps → builder → runner). The runner image is the
Next.js **standalone** server (`next.config.ts` sets `output: "standalone"`),
which bundles only what the app needs. `NEXT_PUBLIC_API_URL` is baked at build
time (it is a client-side constant).

### Manual / Vercel

```bash
npm run build
npm run start       # standalone server on :3000
```

On Vercel: set `NEXT_PUBLIC_API_URL` in project environment variables and
import the repo; framework preset (Next.js) is auto-detected.

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
| 3 | ~~Redis~~ **查清后可以划掉** | 仅 `application.properties` 有 `spring.data.redis.*`，无任何 Java 代码引用，`pom.xml` 里也没有 redis starter —— 这段配置是惰性的 |

### 三条可选路径与代价

1. **VPS / 任意能跑 Docker 的机器（推荐）**。项目本就为这个形态设计。待办：补
   `backend/Dockerfile`（目前缺失，只有 `frontend/Dockerfile`）、前端构建时把
   `NEXT_PUBLIC_API_URL` 指向公网后端、配 https 反代。Flyway 已具备空库 V1→V21
   自动重建能力，数据库初始化无需手工。这是唯一能完整保住 pgvector、调度器和 agent 的路。
2. **迁到 WorkBuddy 云 = 用云服务四模块（Database / Auth / Storage / LLM）重写后端**。
   pgvector 没有等价物，混合检索 + 重排要重新设计；调度器和 agent 的长任务在云服务里
   没有落点。本质是重写半个后端，不是「部署」。
3. **只发前端**。`frontend/Dockerfile` 就是单端口 standalone Node，技术上可发；但
   `NEXT_PUBLIC_API_URL` 默认 `http://localhost:8080`，线上访问不到后端，所有页面都是错误态。
   除非同时按路径 1 把后端部署到公网，否则单独发布没有意义。
