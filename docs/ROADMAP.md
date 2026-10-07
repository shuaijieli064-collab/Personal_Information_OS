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
| **P0** | **Engineering Hardening** | H1–H6（下表） | **▶ 当前** |
| 5.5 | Frontend Experience | Today 2.0、Signal Card 2.0、Information Detail、Command Center UI、Motion、Responsive、全状态、Browser QA（设计方向 A 信号控制台） | ⏭ 下一步 |
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
| H5 | Runtime QA | 真实 PG/Redis/Flyway/Spring 启动 + 全链路 API 走查 + 浏览器走查，结果记入 `docs/RUNTIME_VERIFICATION.md` | ▶ API 走查 ✅（`scripts/e2e-smoke.ps1` 29/29，含 IDOR/登出吊销/RSS sync）；浏览器走查并入 Phase 5.5 S5 |
| H6 | Dead Code | 清理空目录/死 hook/死状态/无引用依赖；无误删核心能力 | ✅ 2026-10-07（inbox 详情接入 TanStack hooks；移除 inboxFilter/mobileNavOpen 死状态、puppeteer-core、空目录；lint 0 warning / tsc 0 / Vitest 11 / build 通过） |

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
