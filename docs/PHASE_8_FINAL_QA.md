# Phase 8 Final QA Report — Automation

> Template: Scope / 变更 / 测试结果 / 运行验证 / 已知问题 / 未验证项 / 冻结结论.
> Evidence: `docs/RUNTIME_VERIFICATION.md` (rows 79–90), `./mvnw -o test`, `npx vitest run`,
> 端到端 API 走查 21/21，调度器自动触发实测。

## Scope

让系统在没有人操作的时候也持续工作：定时拉取信息源、生成每日简报、把反馈重新应用到评分、把重要信号与任务失败通知出来，并且**所有这些都可见、可手动干预、可重试**。

- **In**：调度器（`@Scheduled` tick + 到期扫描）、定时信息源同步、每日简报（LLM 合成 + 确定性降级）、重要信号通知（payload 去重）、自动化反馈回流、任务监控控制台（`/automation`）、**重试 / 线性退避 / 死信**（DEAD + `JOB_FAILED` 通知 + 手动重试复活）。
- **Out**：cron 表达式与自然语言排期（只支持固定间隔）、分布式调度与多实例互斥（单实例假设）、推送通道（邮件/IM/WebPush）、任务依赖编排。

前置：Phase 7 Frozen。反馈回流复用 Phase 5 的评分通道，简报复用 Phase 6 的检索/信号数据；未改动二者语义。

## 变更（Changed）

| 单元 | 内容 |
|---|---|
| 迁移 | `V21__automation.sql`：`scheduled_jobs`（`UNIQUE(user_id,type)`、`interval_minutes`、`enabled`、`last_run_at`、`next_run_at`、`consecutive_failures`，到期热路径走 `idx_scheduled_jobs_due` 部分索引）+ `job_runs`（`status ∈ RUNNING/SUCCEEDED/FAILED/DEAD`、`attempt`、`detail`、`error`、起止时间）+ `notifications`（`type ∈ DAILY_BRIEF/IMPORTANT_SIGNAL/JOB_FAILED`、`title`、`body`、`read`、`payload`）。状态与类型一律 text + CHECK（本代码库无 jsonb / enum 映射），payload 存 JSON 文本 |
| 任务模型 | `com.signal.task`：`JobType`（`SOURCE_SYNC` 默认 60 分 / `DAILY_BRIEF` 1440 分 / `FEEDBACK_LOOP` 360 分，各自带默认节奏）、`JobStatus`、`JobExecutor`（**显式 switch 而非反射** —— 新增类型不接线就编译不过；单条任务的异常被收敛成 `JobResult` 数据，绝不外溢到 tick） |
| 调度器 | `AutomationScheduler`：`@Scheduled(fixedDelayString = ${app.automation.tick-ms})` 扫描 `enabled && next_run_at <= now` 的任务；**重试策略为线性退避** —— 失败则 `consecutive_failures+1`、记 `FAILED`、`next_run_at` 后推 `retry-backoff-minutes × attempt`；累计到 `max-attempts` 时记 `DEAD`、**停用任务**并raise `JOB_FAILED` 通知（不会无限重试）；成功则清零计数并排一个完整间隔。tick 捕获一切异常，单条坏任务不可能拖垮整轮扫描。`retryDeadRun` 是死信的逃生口：重新启用 + 清零计数 + 立刻再跑一次 |
| 具体任务 | `SourceSyncJob`（拉取所有启用信息源，单源失败不影响其余）、`DailyBriefJob`（生成简报）、`FeedbackLoopJob`（把反馈重新应用到评分） |
| 简报 | `BriefService`：取高分信号 + 与 `TodayController` 同源的三项计数，**一次** LLM 调用合成 2–4 句简报，落为 `DAILY_BRIEF` 通知。**降级强制**：合成失败或返回空 → 确定性 `render`（计数 + top 信号标题）兜底，因此「简报因模型宕机而为空」这件事不会发生 |
| 通知 | `NotificationService`：列表（可按未读过滤）/ 未读数 / 最新一条 / 标记单条已读（非本人 → 404，不做静默 no-op）/ 全部已读 / `notifyImportantSignals`（**按 signal id 写在 payload 里做精确匹配去重**，无内存状态、无顺序假设，因此「一个信号只被通知一次」在反复运行的循环下依然成立）/ `notifyJobFailed` |
| API | `AutomationController` `@ /api/v1/automation`：`GET|POST /jobs`、`PATCH|DELETE /jobs/{id}`、`POST /jobs/{id}/run`、`GET /jobs/{id}/runs`、`POST /runs/{id}/retry`。`BriefController` `@ /api/v1/brief`：`GET /latest`（**无简报时返回 `{"brief":null}` 而不是 404** —— 空简报是正常状态）、`POST /generate`。`NotificationController` `@ /api/v1/notifications`：`GET`、`POST /{id}/read`、`POST /read-all`。全部按调用者 principal 做用户隔离 |
| 配置 | `app.automation.enabled`（`AUTOMATION_ENABLED`，默认 true，可整体关停调度）、`app.automation.tick-ms`（`AUTOMATION_TICK_MS`，60000）、`app.automation.max-attempts`（3）、`app.automation.retry-backoff-minutes`（5）、`app.brief.max-signals`（`BRIEF_MAX_SIGNALS`，10）。`.env.example` 已同步 |
| 前端 | 新增 `/automation` 控制台：每日简报面板（最新简报 + 生成按钮 + 从 payload 解析的计数）、定时任务列表（健康度芯片 / 到期标记 / 间隔选择 / 暂停恢复 / 立即运行 / 删除 / 展开看运行历史）、运行历史（状态 / 第几次 / 耗时 / 失败原因 / **重试**）、通知收件箱（未读徽章 / 单条已读 / 全部已读）。新增 `lib/automation/format.ts`（纯函数：`jobTone` / `jobStateKey` / `isDead` / `isPaused` / `runStatusTone` / `isRetryable` / `notificationTone` / `formatInterval` / `ageOf` / `isDue` / `missingTypes`）、`components/ui/automation/{JobCard,RunHistory,NotificationList,BriefPanel}`、10 个 hook；i18n 新增 `Automation` 命名空间（zh-CN / en 键集合相等，469/469） |
| 共享重构 | 把 tone 调色板抽到 `lib/ui/tone.ts` + `components/ui/Chip.tsx`，agent 侧改为再导出（零破坏），automation 侧直接复用 —— 两个控制台的状态色因此天然一致 |

## 测试结果（最终门）

| Check | Command | Result |
|---|---|---|
| Backend 全量回归 | `./mvnw -o test` | ✅ **285 run, 0 failures**（其中 Phase 8 相关 7 个测试类：`task/*` 5 —— `AutomationSchedulerTest` 12、`AutomationControllerTest` 9、`FeedbackLoopJobTest` 11、`JobExecutorTest` 6、`SourceSyncJobTest` 3；`brief/*` 2 —— `BriefServiceTest`、`NotificationServiceTest`） |
| **Browser E2E** | `scripts/verify-automation.mjs`（Playwright + Chrome，`next dev` → 真实后端） | ✅ **17/17**（见下） |
| Frontend lint / tsc | `npx eslint` · `npx tsc --noEmit` | ✅ 0 errors / 0 warnings · clean |
| Unit (frontend) | `npx vitest run` | ✅ **86/86**（新增 `components/ui/automation/automation.test.tsx` 24 项） |
| Build | `NODE_USE_ENV_PROXY=1 npx next build` | ✅ 19 路由，含 `/[locale]/automation`；35 静态页生成 |
| 空库迁移 | fresh DB `signal_verify`，Flyway on boot | ✅ `Successfully applied 21 migrations to schema "public", now at version v21` |
| `ddl-auto=validate` | 同一启动 | ✅ `Started SignalApplication` —— EMF 建立通过，实体与 V21 精确一致 |

## 运行验证（Runtime Verified）

见 `docs/RUNTIME_VERIFICATION.md` 79–90 行。端到端 API 走查 **21/21 通过**，要点：

- **空状态都不是 404**：`GET /jobs` → `{"jobs":[]}`；`GET /brief/latest` → `{"brief":null}`；`GET /notifications` → `{"items":[],"total":0,"unreadCount":0}`。
- **upsert 语义**：`POST /jobs {type:SOURCE_SYNC}` 套用类型默认间隔 60；再 POST 同一类型得到**同一个 id**、列表仍是 1 条、间隔被改写为 30 —— 证明按 `(user,type)` upsert 而非重复插入。
- **参数错误是 400 不是 500**：`POST /jobs {type:"NOPE"}` → **400**。
- **手动运行**：`POST /jobs/{id}/run` → 返回终态运行（实测 `SUCCEEDED`，`detail:"No enabled sources to sync"`）；`GET /jobs/{id}/runs` 最新在前且首条即该运行。
- **暂停 / 恢复**：`PATCH {enabled:false}` → `enabled:false`；`{enabled:true}` → 恢复。
- **简报永不空**：`POST /brief/generate` → `type:DAILY_BRIEF`、body 非空（实测由模型合成的自然语言，而非降级模板）；`GET /brief/latest` 返回同一条；该简报同时出现在通知收件箱（未读 +1）。
- **通知读态**：`POST /notifications/{id}/read` → `read:true`；`POST /notifications/read-all` → 未读数归零。
- **用户隔离**：另一账号 `GET /jobs` 为空；`POST /jobs/{id}/run` 与 `GET /jobs/{id}/runs` 对他人任务均 **404**；未认证 `GET /jobs` → **401**。
- **删除**：`DELETE /jobs/{id}` → 列表归零。
- **调度器自动执行（非手动触发）**：创建 `FEEDBACK_LOOP` 任务 → 直接改库把 `next_run_at` 置为 1 分钟前（此时 `job_runs` 计数为 0）→ 等待一个 tick 周期 → `job_runs` 出现 **1 条** `SUCCEEDED`（`attempt:1`、`detail:"0 signals adjusted from feedback"`），且 `next_run_at` 被推进一个完整间隔（6h）。**没有任何手动调用** —— 证明 tick 真的会自己捞起到期任务。
- **前端单测**：`/automation` 在 AuthGuard 下渲染，侧栏新增「自动化」入口（`ClockCountdown` 图标）；任务卡健康度、运行历史重试按钮、未读徽章与已读操作均由 `automation.test.tsx` 的 24 项断言覆盖。
- **浏览器实测（`scripts/verify-automation.mjs`，17/17）**：真实 Chrome 驱动 `next dev` → 真实后端（`scripts/seed-automation-session.mjs` 种一个会话 + 3 个任务 + 一份简报）：
  - 页面在 AuthGuard 下渲染（`h1="自动化"`），简报面板显示真实生成的简报正文；
  - 三种任务类型都以 zh-CN 标签列出，健康度芯片同时出现「运行中」与「已暂停」（种子把反馈任务暂停），间隔选择器显示真实节奏（1d / 6h）；
  - 展开任务 → 运行历史出现真实终态运行（`成功 · 第 1 次`）；
  - **暂停 → 已暂停 → 恢复 → 运行中** 与真实 API 往返；「立即运行」追加一条新运行；
  - 收件箱列出简报通知；点「生成简报」后出现 `3 条未读`，「全部已读」清空徽章；
  - `/en/automation` 渲染同一控制台（`h1="Automation"`）；
  - 390 / 768 视口 `scrollWidth - clientWidth = 0`（无横向溢出）；
  - **0 console error**。
- **浏览器实测抓到一个真实缺陷（已修）**：`MISSING_MESSAGE: Could not resolve \`Automation.notifBrief\` in messages for locale zh-CN` —— 通知类型芯片的 3 个文案键（`notifBrief` / `notifSignal` / `notifJobFailed`）被 `NotificationList` 引用却从未写进任何一份词条。**tsc、eslint、单测全部无法发现**（单测的 i18n mock 只是把 key 原样回显，从不校验）。修复：两份词条补齐 3 个键；**并且**把 `next-intl` 的测试替身换成会校验的实现（`frontend/test/i18n.ts`）：每个键都对着真实 `zh-CN` 词条解析，遇到未知键直接抛错。automation / agent / knowledge 三个控制台的测试都已改用，从此单测能拦住这一类问题（三个套件在切换后全绿，说明没有第二处缺键）。

## 已知问题 / 已记录偏差

- **单实例假设**：调度器没有分布式锁。多实例部署会让同一个到期任务被每个实例各跑一次 —— 这是刻意的范围选择（本阶段目标是单实例本地部署），已记录，未做互斥。
- **只支持固定间隔**，不支持 cron 表达式或自然语言排期。
- `next_run_at` 是 `NOT NULL`：任务被死信停用时写回 `now()` 占位（该值因 `enabled=false` 而惰性，但列约束必须满足）。代码里有注释说明。
- 简报的计数来自与 `TodayController` 同源的扫描（`SCAN_LIMIT = 100`），超大数据集下计数是**上限为 100 的近似**而非精确总数（信号总数取自分页 total，是精确值）。
- 前端「重试」按钮在 `FAILED` 与 `DEAD` 两种运行上都出现 —— 后端 `retryRun` 对二者都接受（它会顺带重新启用并清零计数），语义上是「再试一次」，不是只服务死信。
- **i18n 缺键曾是 tsc / eslint / 单测都看不见的一类缺陷**（本次由浏览器实测抓到）。现有三道防线：词条键集合跨语言对等校验（472/472）、三个控制台测试的校验型 `next-intl` 替身、以及浏览器 E2E 的 console-error 断言。**残留盲区**：键通过查表得到的（`t(TYPE_LABEL[type])`、`t(AGE_KEY[unit])` 这类）静态扫描看不到，只能靠「渲染时校验」或浏览器实测覆盖；页面级组件（如 `/automation` 页本身）未被单测渲染，其查表键仍只由浏览器实测兜底。
- 浏览器实测需以 `http://localhost:3000` 驱动 dev server；用 `127.0.0.1` 会被 Next.js 的跨域 dev 资源保护挡住，客户端 bundle 不加载，页面只剩语言切换器 —— 一个容易被误读成「页面坏了」的假信号。
- 构建期注意：`.next` 的旧缓存清理会撞沙箱批量删除护栏，需先把 `.next` 移走再 `next build`；`next/font/google` 需 `NODE_USE_ENV_PROXY=1`。

## 未验证项（Not Verified）

- **死信路径的真实触发**：`max-attempts` 达到后停用任务 + raise `JOB_FAILED` 的行为由单测覆盖（`AutomationSchedulerTest`），未做「连续 3 次真实失败」的端到端演练（需要一个稳定失败的作业）。
- 调度器在**多实例**下的行为（无互斥，预期重复执行）。
- 长时间运行的稳定性（数小时 / 数天的 tick 漂移与内存）。
- 通知推送通道（当前只有站内收件箱，没有邮件/IM/WebPush）。
- 生产模式（`next start`）下的 `/automation` 浏览器交互走查（构建绿、路由已生成，交互断言跑在单测层）。
- 跨浏览器与读屏。

## 冻结结论

**PHASE 8 — FROZEN (2026-10-16)**。调度器 / 定时同步 / 每日简报 / 重要信号通知 / 反馈回流 / 任务监控 / 重试与死信全部交付；四门 + 后端全量 285 测试 + 前端 86 测试 + 空库 V1→V21 迁移与 `ddl-auto=validate` + 端到端 API 21/21 + **调度器自动触发实测** 全部通过。

至此 Phase 6 → 7 → 8 主线走完，`docs/ROADMAP.md` 中 Phase 6–8 全部由「规划 / 进行中」转为完成。后续仅接受 bugfix；新增能力（分布式调度、推送通道、cron 排期）属独立阶段，不在本次冻结范围。
