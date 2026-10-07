# SIGNAL — Roadmap

> Phase structure follows the project documentation suite (01 总计划书 / 06 开发实施计划与验收手册).
> Frozen phases are **bugfix-only**; no feature additions to frozen scope.

## Phase status

| Phase | Name | Scope | Status |
|---|---|---|---|
| 1 | Foundation | 边界、架构、技术栈、工程初始化 | ✅ Frozen |
| 2 | Experience Foundation | Next.js/Spring Boot 骨架、Motion、Intro、API ping | ✅ Frozen |
| 3 | Identity & Personalization | Auth、Profile、Goal、Interest、Skill、IDOR 测试 | ✅ Frozen |
| 4 | Information Ingestion | RSS/GitHub/URL/File、标准化、Exact Dedup、Inbox、SSRF | ✅ Frozen |
| 5 | Intelligence & Signals | Understanding、Embedding、Semantic Dedup、Relevance、Signal Score、Today、Feedback | ✅ Frozen |
| **P0** | **Engineering Hardening** | H1–H6（下表） | **✅ 完成 2026-10-07** |
| **5.5** | **Frontend Experience** | Today 2.0、Signal Card 2.0、Information Detail、Command Center UI、Motion、Responsive、全状态、Browser QA（设计方向 A 信号控制台） | **▶ 当前（S0–S4 ✅，S5 待做）** |
| 6 | Knowledge & Retrieval | Chunk、Embedding、Vector Retrieval、Hybrid Search、Rerank、RAG、Citation | 📋 规划 |
| 7 | Agent & Tools | Tool Registry、Permission、Planner/Executor、Audit、Confirmation | 📋 规划 |
| 8 | Automation | Scheduled Sync、Daily Brief、Notification、Feedback Loop、监控/重试 | 📋 规划 |

**硬性顺序**：先 Hardening，再 5.5，再 6 → 7 → 8。不在不稳定基础上堆功能。

## P0 Hardening queue (H1–H6)

| # | Task | Acceptance | Status |
|---|---|---|---|
| H1 | Migration Consolidation | 唯一权威 `backend/src/main/resources/db/migration/`；空库 V1–V12 顺序执行并 `ddl-auto=validate` 通过 | ✅ 2026-10-07（根目录重复 `db/migrations/` 已删除；新增 V12 对齐 JPA 实体） |
| H2 | Docs Sync | README/ROADMAP/docs 与实际阶段一致，无过期描述 | ✅ 2026-10-07 |
| H3 | Git Consolidation | 单仓、业务代码全入库、无密钥入库 | ✅ 2026-10-07（`frontend/.git` 不存在；`resources/.env` 已移除防打包泄漏） |
| H4 | Auth Hardening | Route Guard 全覆盖；401 refresh 单飞；重放仍 401 → clear+broadcast（不吞错） | ✅ 2026-10-07（client.ts 重放边界修复 + 回归测试，Vitest 11/11） |
| H5 | Runtime QA | 真实 PG/Redis/Flyway/Spring 启动 + 全链路 API 走查 + 浏览器走查，结果记入 `docs/RUNTIME_VERIFICATION.md` | ✅ 2026-10-07（API 走查 29/29；桌面浏览器走查并入 5.5 S4，响应式宽度走查在 S5） |
| H6 | Dead Code | 清理空目录/死 hook/死状态/无引用依赖；无误删核心能力 | ✅ 2026-10-07（inbox 详情接入 TanStack hooks；移除 inboxFilter/mobileNavOpen 死状态、puppeteer-core、空目录；lint 0 warning / tsc 0 / Vitest 11 / build 通过） |

## Phase 5.5 execution (S0–S5)

| # | Stage | Content | Status |
|---|---|---|---|
| S0 | 设计原型 | today / 登录 / 首页 三屏高保真（方向 A，`ui-design-runs/s0-signal-console/`） | ✅ 用户确认通过 |
| S1 | Tokens | `tokens.css` 方向 A 全量（冷石板色板 / display 字阶 / shell·card·control·pill 圆角 / 发光阴影）+ `@theme` 映射 + Space Grotesk·Inter·JetBrains Mono | ✅ `e350e09` |
| S2 | Components | Button 三态发光 + focus ring、Input/Select 发光 focus、EmptyState 图标盘、CountUp reduced-motion、signal-pulse keyframes（ui tests 16/16） | ✅ `aaf54cd` |
| S3 | Pages | P0 三屏（today 信号控制台 / 分屏 auth / 满版 landing）+ P1 五页（AppShell 发光导航+移动顶栏、inbox 分组头+新鲜度点+mono 时间戳、sources 主卡+状态徽章、onboarding 步进器+胶囊 TagInput、settings 图标轨两栏）+ P2 a11y（对比度复验、统一 focus 指示） | ✅ `a227ea1` + `50b99ef` + P2 |
| S4 | 验证 | lint 0 / tsc 0 / vitest 16 / build 0；16 路由浏览器走查 h1 渲染 + console 0 错；UI 数据链路实测（注册→onboarding→today；建源→同步 20 条→inbox 行）；文档同步 | ✅ 2026-10-07 |
| S5 | 响应式 + 全状态 | 1440/1024/768/390 响应式走查 + 空/加载/错误态截图对比板（a11y 快扫复查） | ⏭ 下一步 |

**已记录偏差（数据/范围现实与设计稿差异）**：today API 无时间序列与时间戳 → sparkline/同比徽章以 CountUp + 信号占比压缩条替代，时间线用 rank 序号；inbox 无读/未读字段 → 新鲜度点（≤24h 绿 / ≤7d 琥珀 / 更早灰）做密度分级；移动端不做抽屉 → 底栏导航 + 新增顶栏品牌场承担；focus ring 用 signal 2px（较 accent-soft 更强可见性）；`useDiscover` 不再探测 planned 端点（本地兜底，端点上线后恢复）。

## Risks

| Risk | Mitigation |
|---|---|
| LLM 幻觉污染 summary / why | 事实型模板 + 规则评分优先 + 引用原文 |
| Prompt injection via 外部内容 | SYSTEM / USER_PROFILE / UNTRUSTED_CONTENT 隔离（PromptBoundary，有单测） |
| 去重质量回退 | URL hash → title 相似 → pgvector 语义三级，阈值可配置 |
| 第三方 ToS / 私有数据 | 仅 RSS、公开 API、用户主动导入；SSRF 防护 |
| 假验证 | 所有"完成"必须附运行证据；未验证项显式标 NOT VERIFIED |
| 密钥泄漏 | `.env` gitignore + 不入 jar + CI 扫描 |

## Future (Phase 6–8 详细任务拆解)

- **Phase 6**: Document/Information Chunking → Embedding Pipeline → Vector Index → Hybrid Retrieval → Reranker → Context Builder → RAG API → Citation UI → Knowledge Page（另含 `/api/v1/discover` 后端、Information 归档动作等 5.5 遗留 backlog）
- **Phase 7**: Tool Registry/Schema → Permission Model → Planner → Executor → Observation → Audit Log → Confirmation UI → Failure Recovery
- **Phase 8**: Scheduler → Scheduled Source Sync → Daily Brief → Important Signal Notification → Automated Feedback Loop → Job Monitoring → Retry/Dead Letter

每阶段交付必须附：验收模板（Scope/变更/测试结果/运行验证/已知问题/未验证项/冻结结论）→ `docs/PHASE_X_FINAL_QA.md`。
