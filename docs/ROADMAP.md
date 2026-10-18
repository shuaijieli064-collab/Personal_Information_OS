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
| **5.5** | **Frontend Experience** | Today 2.0、Signal Card 2.0、Information Detail、Command Center UI、Motion、Responsive、全状态、Browser QA（设计方向 A 信号控制台） | **✅ 完成 2026-10-07（S0–S5 全部）** |
| 6 | Knowledge & Retrieval | Chunk、Embedding、Vector Retrieval、Hybrid Search、Rerank、RAG、Citation、Context Builder | ✅ Frozen 2026-10-16（`docs/PHASE_6_FINAL_QA.md`） |
| 7 | Agent & Tools | Tool Registry、Permission、Planner/Executor、Audit、Confirmation、Failure Recovery | ✅ Frozen 2026-10-16（`docs/PHASE_7_FINAL_QA.md`） |
| 8 | Automation | Scheduled Sync、Daily Brief、Notification、Feedback Loop、Job Monitoring、Retry/Dead Letter | ✅ Frozen 2026-10-16（`docs/PHASE_8_FINAL_QA.md`） |
| **5.5+** | **UI 重铸 · 方向 B「晨报 The Brief」** | 四轴反转设计语言、报头 + 竖排文字轨 + 头版语法、晨/晚报双 impression、字体自托管（构建离线化） | **✅ 完成 2026-10-17（`docs/UI_RECAST_BRIEF.md`）** |

**硬性顺序**：先 Hardening，再 5.5，再 6 → 7 → 8。不在不稳定基础上堆功能。
5.5+ 是在 Phase 8 冻结之后、对**视觉层**的独立重铸，不触碰 Phase 1–8 的任何后端契约。

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
| S5 | 响应式 + 全状态 | 1440/1024/768/390 响应式走查 + 空/加载/错误态截图对比板（a11y 快扫复查） | ✅ 2026-10-07（18 组宽度×页面 0 横向溢出，断点切换 DOM 实证；loading/empty/error/login-401 共 8 态截图 + `ui-design-runs/s5-board.html` 对比板；证据 `docs/RUNTIME_VERIFICATION.md` 23–25 行） |

**已记录偏差（数据/范围现实与设计稿差异）**：today API 无时间序列与时间戳 → sparkline/同比徽章以 CountUp + 信号占比压缩条替代，时间线用 rank 序号；inbox 无读/未读字段 → 新鲜度点（≤24h 绿 / ≤7d 琥珀 / 更早灰）做密度分级；移动端不做抽屉 → 底栏导航 + 新增顶栏品牌场承担；focus ring 用 signal 2px（较 accent-soft 更强可见性）；`useDiscover` 不再探测 planned 端点（本地兜底，端点上线后恢复）。

## Phase 6–8 execution

| Phase | 单元 | Commit | Status |
|---|---|---|---|
| 6 | K1 地基（V13–V15、Mock 384 维嵌入、OpenAI 兼容嵌入通道） | `7228d0e` | ✅ |
| 6 | K2–K4 + 混合检索（分块/嵌入/向量检索/RAG/RRF `mode=HYBRID·VECTOR·KEYWORD`、V19 全文 GIN） | `25fa930` | ✅ |
| 6 | Rerank（`RerankProvider` + DashScope `qwen3.7-text-rerank`，默认开启可降级） | `72e3b98` | ✅ |
| 6 | Knowledge 控制台（`/knowledge` 检索/问答/重建索引、引用芯片、来源腿徽章） | `db75d76` | ✅ |
| 6 | Context Builder（`ContextBuilder` + `KnowledgeAskService` 委托 + `ContextBuilderTest`） | 本次 | ✅ |
| 7 | 工具协议 + 权限模型（`AgentTool`/`ToolRegistry`/`ToolPermission`）+ 8 工具（READ 5 / WRITE 3） | 本次 | ✅ |
| 7 | Planner（单次结构化调用、降级单步 `askKnowledge`）+ Executor（权限门、重试一次、失败续跑） | 本次 | ✅ |
| 7 | 审计（V20 `agent_runs`/`agent_steps`）+ `AgentController`（tools/runs/confirm/reject） | 本次 | ✅ |
| 7 | 代理控制台前端（`/ai` 目标→时间线→确认面板→工具目录→历史运行） | 本次 | ✅ |
| 8 | 迁移（V21 `scheduled_jobs`/`job_runs`/`notifications`）+ 任务模型（`JobType`/`JobStatus`/`JobExecutor`） | 本次 | ✅ |
| 8 | 调度器（tick 扫描、线性退避、DEAD 死信 + `JOB_FAILED` 通知、手动重试复活）+ 三个具体任务 | 本次 | ✅ |
| 8 | 简报（`BriefService` 确定性降级）+ 通知（payload 去重的 `IMPORTANT_SIGNAL`） | 本次 | ✅ |
| 8 | API（`/automation`、`/brief`、`/notifications`）+ 任务监控控制台前端（`/automation`） | 本次 | ✅ |

**Phase 6–8 已记录偏差**：重排故障降级而嵌入故障 502（重排是精度增强，不是可用性前提）；调度器为单实例假设，无分布式互斥；排期只支持固定间隔（无 cron / 自然语言）；简报计数上限为 100 的扫描近似；`DESTRUCTIVE` 权限已建模但暂无工具使用。

## 5.5+ UI 重铸 — 方向 B「晨报 The Brief」

| 单元 | 内容 | Status |
|---|---|---|
| 方向选择 | 三方向并排对比（B 晨报 / C 临床 / D 会所），按明度·材质·字体·几何四轴量化差异，用户拍板 **B** | ✅ |
| 令牌层 | `design-tokens/brief.css` 沿用旧令牌**同名变量**，`globals.css` 只改 import → 全部组件无需改名即换装 | ✅ |
| 外壳 | 报头 `Masthead`（名plate + 朱砂印 + dateline 期号日期 + 工具组 + 双细规线）；竖排文字轨 `Sidebar`（`writing-mode: vertical-rl`，永不折叠）；删除 `TopBar` | ✅ |
| 页面 | 头版 `today`（数据条 → 头条 → 双分栏 → 报尾）、auth 报纸展开页、intro、landing | ✅ |
| 组件基元 | Button/Chip/IconButton/Input/Select/Segmented/Skeleton/PageHeader/StatCard/AuthCard/CommandCenter/SignalTimeline/CornerControls 全部扁平化（圆角 2–3px，去玻璃/光晕/投影） | ✅ |
| 双版式 | `light` 晨报（默认）/ `dark` 晚报；cookie 驱动 SSR 首屏不闪烁 | ✅ |
| 字体自托管 | `scripts/selfhost-fonts.mjs` → `frontend/public/fonts/`（115 woff2 / 6.3 MB）+ 生成 `frontend/app/fonts.css`（333 `@font-face`）；移除 `next/font/google`，构建离线化 | ✅ |
| 验证 | tsc / eslint / vitest 87 / `next build` 19 路由 / 字体可达性 / 浏览器走查 **51/51（dev 与生产模式各一轮）** / 浏览器实取字体 / i18n 490 键对齐 | ✅ |

**5.5+ 已记录偏差**：主题由 cookie 驱动使路由表从「35 页静态预渲染」变为 **19 条全 `ƒ` Dynamic**（SSR 首屏不闪烁的代价）；CJK 自托管占仓库 5.75 MB（运行时不浪费，`unicode-range` 按需下载，实测页面只取 9–15/101 分片）；跨浏览器/读屏与 `output: standalone` 产物走查仍未做。

## Risks

| Risk | Mitigation |
|---|---|
| LLM 幻觉污染 summary / why | 事实型模板 + 规则评分优先 + 引用原文 |
| Prompt injection via 外部内容 | SYSTEM / USER_PROFILE / UNTRUSTED_CONTENT 隔离（PromptBoundary，有单测） |
| 去重质量回退 | URL hash → title 相似 → pgvector 语义三级，阈值可配置（前两级已实现；语义级 2026-10-18 接线，见 RUNTIME_VERIFICATION 120–121 行） |
| 第三方 ToS / 私有数据 | 仅 RSS、公开 API、用户主动导入；SSRF 防护 |
| 假验证 | 所有"完成"必须附运行证据；未验证项显式标 NOT VERIFIED |
| 密钥泄漏 | `.env` gitignore + 不入 jar + CI 扫描 |

## Future (Phase 9+ 候选)

- **Phase 6–8 已全部完成**（2026-10-16）。主线功能闭环：信息入库 → 理解/评分 → 检索/重排/RAG → 代理执行 → 定时自动化与通知。
- **Phase 9 候选**（均为独立阶段，不在 Phase 8 冻结范围）：
  - 分布式调度（多实例互斥 / 选主），解除单实例假设。
  - 排期表达力：cron 表达式、自然语言排期。
  - 通知推送通道：邮件、IM（企业微信 / 飞书）、WebPush。
  - 代理计划升级：依赖图、失败后重新规划、跨运行记忆。
  - `/api/v1/discover` 后端端点（前端目前是本地兜底，端点上线后恢复探测）。
  - 检索规模化：>10⁵ chunks 的延迟与召回基准、按文档/时间范围过滤、多轮问答。
- **遗留技术债**：跨浏览器（Firefox/WebKit）与读屏；`DESTRUCTIVE` 权限尚无真实工具可走查；UI 重铸的像素级视觉回归与 `output: standalone` 产物走查。（生产模式的浏览器交互走查已于 2026-10-17 补齐。）

每阶段交付必须附：验收模板（Scope/变更/测试结果/运行验证/已知问题/未验证项/冻结结论）→ `docs/PHASE_X_FINAL_QA.md`。
