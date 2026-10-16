# Phase 7 Final QA Report — Agent & Tools

> Template: Scope / 变更 / 测试结果 / 运行验证 / 已知问题 / 未验证项 / 冻结结论.
> Evidence: `docs/RUNTIME_VERIFICATION.md` (rows 71–78), `./mvnw -o test`, `npx vitest run`.

## Scope

让 SIGNAL 从「回答一个问题」升级为「完成一个目标」：把系统能力注册成带权限的工具，用 LLM 规划、按顺序执行、只读步骤自动跑、写操作停下来等人确认，全过程可审计。

- **In**：工具协议（`AgentTool` + JSON 参数 schema）、`ToolRegistry`、**权限模型**（READ / WRITE / DESTRUCTIVE）、`AgentPlanner`（单次结构化调用出计划）、`AgentExecutor`（权限门 + 失败重试 + 不中断续跑）、`AgentRunService`（落库与汇总降级）、审计日志（`agent_runs` / `agent_steps`）、确认 UI（`/ai` 控制台）、失败恢复。
- **Out**：并行/有依赖图的计划（当前是线性序列）、长时后台任务（属 Phase 8）、工具级速率限制与配额、跨运行记忆。

前置：Phase 6 Frozen。工具层直接复用 Phase 6 的 `KnowledgeSearchService` / `KnowledgeAskService`，未改动其语义。

## 变更（Changed）

| 单元 | 内容 |
|---|---|
| 工具协议 | `com.signal.ai.tools`：`ToolPermission{READ,WRITE,DESTRUCTIVE}`、`AgentTool`（name / description / permission / parameters / required / invoke）、`ToolRegistry`（由注入的 bean 列表构建；**重名直接启动失败**，因为重名会让工具选择产生歧义）、`ToolArgs`、`ToolInvocationException` |
| 工具集（8 个） | **READ 5 个**：`searchKnowledge`、`askKnowledge`、`listSignals`、`todaySummary`、`listSources`；**WRITE 3 个**：`syncSource`、`archiveInformation`、`addGoal` |
| 规划 | `AgentPlanner`：目录（可信文本）走 SYSTEM 通道，目标（用户输入，可能内嵌粘贴内容）走 QUESTION 通道 —— 用户写的内容无法伪装成规划指令；**降级强制**：LLM 不可用或输出不可解析时回退为确定性单步 `askKnowledge(goal)` |
| 执行 | `AgentExecutor`：READ 立即执行；WRITE / DESTRUCTIVE **不执行**，步骤置 `PENDING_CONFIRMATION`、运行停在 `AWAITING_CONFIRMATION`；单步抛错**重试一次**，二次失败记 `FAILED` 并**继续后续步骤**（无依赖图，一步坏掉不该毁掉整轮）；执行器只改内存实体，落库交给 service，状态机因此可无库单测 |
| 持久化 | `V20__agent_runs.sql`：`agent_runs`（goal / status / answer / model / error）+ `agent_steps`（seq / tool / permission / status / arguments / result / rationale / error / 时间戳） |
| API | `AgentController` `@ /api/v1/agent`：`GET /tools`、`POST /runs`、`GET /runs`、`GET /runs/{id}`、`POST /runs/{id}/confirm`、`POST /runs/{id}/reject`；全部用户隔离（他人 run → 404） |
| 前端 | 重写 `/ai` 为代理控制台：目标输入 + 最大步数 → 计划与执行时间线（每步显示权限徽章、参数、结果摘要、失败原因）；待确认步骤弹出 `ConfirmationPanel`（确认 / 拒绝 + 备注）；工具目录面板标注必需参数；历史运行列表。新增 `lib/agent/format.ts`（纯函数：tone 映射、`isGated`、`pendingStep`、`formatArguments`、`summarizeResult`）、`components/ui/agent/{Chip,StepTimeline,ConfirmationPanel,ToolCatalog}`、`agentApi` + 5 hook；i18n 用 `Agent` 命名空间替换旧的 `AI` |
| 配置 | `app.agent.max-steps`（`AGENT_MAX_STEPS`，默认 6）、`app.agent.max-plan-steps`（`AGENT_MAX_PLAN_STEPS`，默认 10） |

## 测试结果（最终门）

| Check | Command | Result |
|---|---|---|
| Backend 全量回归 | `./mvnw -o test` | ✅ **285 run, 0 failures**（其中 Phase 7 相关 13 个测试类：`ai/tools/*` 9 + `ai/agent/*` 4） |
| Frontend lint / tsc | `npx eslint` · `npx tsc --noEmit` | ✅ 0 errors / 0 warnings · clean |
| Unit (frontend) | `npx vitest run` | ✅ 86/86（`lib/agent/format.test.ts` 14 项 + `components/ui/agent/agent.test.tsx` 8 项） |
| Build | `NODE_USE_ENV_PROXY=1 npx next build` | ✅ 含 `/[locale]/ai` 路由 |
| 空库迁移 | fresh DB，Flyway on boot | ✅ `Successfully applied 21 migrations … now at version v21`（含 V20） |

## 运行验证（Runtime Verified）

见 `docs/RUNTIME_VERIFICATION.md` 71–78 行，要点：

- **权限门真的拦得住**：规划出写操作时，运行停在 `AWAITING_CONFIRMATION`，该步骤为 `PENDING_CONFIRMATION` 且**未被执行**（副作用未发生）；确认后继续、拒绝后运行转 `REJECTED`。
- **规划降级**：AI provider 故障时计划退化为单步 `askKnowledge`，运行仍能给出答案而不是 5xx。
- **失败续跑**：注入一个必失败的步骤，验证「重试一次 → 记 FAILED → 后续步骤照常执行」。
- **审计完整性**：每个步骤的 tool / permission / arguments / result / error / 起止时间都可在 `GET /runs/{id}` 读回，`GET /runs` 分页返回历史。
- **隔离**：他人 run 的 `GET` / `confirm` / `reject` 均 404；未认证 401。
- **前端**：`/ai` 在 AuthGuard 下渲染；提交目标 → 时间线逐步出现；待确认面板出现时确认/拒绝按钮可用，请求在途时两者同时禁用（`agent.test.tsx` 覆盖）。

## 已知问题 / 已记录偏差

- 计划是**线性序列**，没有依赖图 —— 因此「一步失败继续跑」是安全的，但也意味着后续步骤不会基于失败步骤的结果重新规划。
- 工具参数由 LLM 给出，可能缺失必需参数；此时工具抛 `ToolInvocationException`，被计为该步骤失败（重试一次后继续），不会让整轮崩溃。
- 前端工具目录的 `parameters` 只展示名称与描述，不做表单化编辑 —— 参数由规划器填充，用户只对「是否执行」做决策。
- 运行是**同步**的（请求内完成计划 + 只读步骤）；长时任务不在本阶段范围。

## 未验证项（Not Verified）

- 真实 LLM 在多步复杂目标下的规划质量（单步/双步目标已实测，未做规模化基准）。
- `DESTRUCTIVE` 权限目前**没有工具使用**（只有 READ / WRITE）—— 权限枚举与 UI 已就绪，但没有真实破坏性工具可走查。
- 并发运行同一目标的隔离（未做压力测试）。
- 跨浏览器与读屏。

## 冻结结论

**PHASE 7 — FROZEN (2026-10-16)**。工具协议 / 权限模型 / 规划器 / 执行器 / 审计 / 确认 UI / 失败恢复全部交付，四门 + 后端全量测试 + 前端单测通过；后续仅接受 bugfix。

遗留（未纳入本阶段）：依赖图计划、长时后台运行（Phase 8 以定时任务承接）、工具配额。
