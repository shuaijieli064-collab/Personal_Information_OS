# SIGNAL 体验与质量评审 · 优化点清单

> 评审时间：2026-10-17 · 方式：读代码 + 查库 + 真实浏览器截图（`ui-design-runs/review-shots/`）
> 触发原因：「感觉还得优化，体验不是很好，AI 内容生成和一些信息看起来不是很好」
> 结论：**产品骨架没问题，问题集中在「真实管线」与「演示数据」两套东西不一致，以及收件箱三件套（忽略/保留/生成信号）没有真正接上后端。**
> 更新（2026-10-19）：第三批四条（#13 知识首屏、#14 来源名、#15/#16 测试数据）也已落地并回归全绿。
> 至此 #1 / #2 / #3 / #5 / #6 / #7 / #8 / #9 / #10 / #11 / #13 / #14 / #15 / #16 全部关闭，
> 只剩 **#4 演示数据走真实管线** 与 **#12 通知 payload 带 top signals** 两项，见下方「本轮已修」三张表。

## 一句话诊断

演示账号里看到的是「精心写好的中文内容 + 0–1 的漂亮分数」，而真实管线产出的是「英文模板理由 + 0–100 的分数」。
两者混在同一套界面里，于是**看起来既不准也不一致**。不是模型不行，是契约没统一、演示数据绕过了管线。

## 本轮已修（2026-10-17 晚）

| 原编号 | 问题 | 改法 | 验证 |
|---|---|---|---|
| #2 | 分数两套尺度 | `V22__score_scale_and_why_cleanup.sql`：≤1 的历史分数一次性 ×100，随后加 `CHECK (0..100)` 约束（signals + information_understanding）；种子脚本改 0–100；`today` / `SignalTimeline` 按整数渲染 | 库内 `min=72 max=96`、`≤1` 行数为 0、两条约束存在；页面显示 `score 96`，分数环填满（此前 0.96 渲染成近乎空环） |
| #1 | 「为什么重要」是英文模板 | `Relevance` 改为结构化（`matchedGoal` / `matchedInterests`，不再产出散文）；新增 `WhyItMattersService` 走 `PromptBoundary` + 模型生成，失败留 `null`（UI 隐藏该块，绝不回落英文）；`V22` 清空历史英文文案 | 真实导入一条命中目标的内容 → 信号 73.3 分，理由为模型写的中文：「这篇文章是你十二篇 DDIA 笔记计划里的第三篇…正好对应你对 PostgreSQL 的关注。」 |
| #9 / #11 | 晨报标题与通知标题硬编码 | 标题改由前端按 `type + payload` 组合（`notifBriefTitle` / `notifJobFailedTitle`），中英各一套键 | 库中标题仍是 `Daily brief: 18 signals`，界面显示「晨报 · 18 条信号」；重新生成简报后正文为模型写的中文编辑体 |
| #10 | 工具目录描述全英文 | `Agent.toolDesc.*` 八个键，`ToolCatalog` 用 `t.has()` 命中翻译、否则回落 API 描述 | `/ai` 截图：`为你新建一个目标。` / `把某条信息归档，让它离开活跃信息流。` |
| — | i18n 测试替身不支持 `has` 与点号路径 | `frontend/test/i18n.ts` 补 `t.has` 并支持嵌套键解析 | vitest 87/87（修前 1 项失败） |

### 第二批：收件箱三件套（#5 / #6 / #7 / #8）

| 原编号 | 问题 | 改法 | 验证 |
|---|---|---|---|
| #5 | 「忽略」只存 React state，刷新复活 | `V23__information_triage_status.sql` 放宽既有 `information.status` 的取值域为 `ACTIVE / KEPT / ARCHIVED`（复用 V15 的列与 `idx_information_user_status`，不加第二列）；新增 `PATCH /api/v1/information/{id}`；前端 `setStatus` mutation 成功后失效 `inbox` / `inboxIgnored` / `today` 三个 key | `inbox-verify` 走真实 UI：点「忽略」→ 重新加载 → 行从「需要处理」消失、出现在「已忽略」；点「恢复」→ 重新加载 → 回到「需要处理」。`InformationControllerTest` 6/6（含他人行 → **404**、非法状态 → **400** 且不落库） |
| #6 | 「AI 过滤」栏永远是 0 条 | 整栏删除（宁缺勿假），原位换成**真实数据**的「已生成信号」区（`useToday().signalCount` + `SignalTimeline`） | 该区显示库里真实的 18 条信号，不再是占位文案 |
| #7 | 「生成信号」只跳详情页；「保留」什么都不做 | 「分析」改调真实 `POST /information/{id}/understanding`，由管线决定是否成信号；成功回报**管线算出的分数**而不是假装生成；「保留」写 `KEPT` | 走查点击「分析」→ 提示「已分析：信号分 56。达到门槛的条目才会出现在「已生成信号」。」——56 < 阈值 70，因此**没有**生成信号，阈值仍然生效 |
| #8 | 所有条目都堆在「需要处理」 | `reviewItems = items.filter(it => !signalIds[it.id])`；后端 `GET /information` 支持 `status` 过滤与 `signalIds` 映射 | 「需要处理」从 19 条（其中 18 条已处理）变为真实的 1 条；UI 行数与 API 交叉核对一致：`ui=1 api=1 (of 19 active/kept)` |
| #3 | **语义去重是死代码**，README 却宣称「Exact + semantic dedup」 | `SemanticDedupService` 全仓无调用方；V7 建的 `signal_clusters` / `signal_sources` / `information_embeddings` 三张表也从未被写过，跨源同一文章会各生成一条信号 | 删除死代码，改由 `DuplicateSignalGuard` + `InformationEmbeddingStore` 实现：只对**够格成信号**的条目做 embedding（每条信号一次，不是每条入库一次），pgvector 找同用户下最近的另一条，相似度 ≥ 阈值（`app.dedup.similarity-threshold:0.85`）则条目照常入库但不生成第二条信号，并写一行 `signal_sources` 作为「互相印证」的凭据；embedding 或查询失败一律按「不重复」降级（只 WARN，绝不影响管线） | 见验证行 |

### 第三批：首屏、来源名与测试数据（#13 / #14 / #15 / #16）

| 原编号 | 问题 | 改法 | 验证 |
|---|---|---|---|
| #13 | **知识页首屏只有一个空表单**（245 字符），用户不知道该搜什么、也不知道语料有没有建好 | 新增 `GET /api/v1/knowledge/stats`（`documents / chunks / embedded / lastIndexedAt`，空语料时 `lastIndexedAt=null`），首屏把它显示在「索引」卡片里；语料为空时额外提示去「重建索引」。再加一行「试试这些」——三条示例问题按账号真实兴趣（权重前 3）生成，无兴趣时退化为两条通用问题。点击填入当前标签页的输入框 | `learn-verify` 新增两条断言：页面上的数字必须等于 API 返回的数字（`page=19/20 api=19/20`——写死数字会像上一轮那样在数据变化时假失败）；示例条存在且来自真实兴趣（`关于「系统设计」，我记录了什么？`）。`KnowledgeControllerTest` 补 `statsReportTheCorpusAndTolerateAnEmptyOne`（含空语料不 500、不编造时间） |
| #14 | **收件箱行尾只有 `ARTICLE 2026/10/17`**，判断不了来源可信度 | `GET /information` 响应增加 `sourceNames`（source id → 名称），与既有 `signalIds` 同一种批量映射模式，纯增量不改 items 形状；`InboxItem` 在类型前显示来源名（过长截断 + `title` 全称） | 实测渲染：`FILE import · DOCUMENT · 已保留`。断言不写死来源清单（第一版写死六个种子源，遇到 `FILE import` 行就误报失败）——改为从 API 取该行真实来源名再比对。`InformationControllerTest` 补 `feedNamesTheSourceOfEachRow`（含 source_id 为空的导入行不影响批次） |
| #15 / #16 | **测试数据残留**：`ai-check.txt` / `hybrid-e2e.txt` / `rerank-e2e.txt` / `Example Domain`，以及一批探针账号 | 新增 `scripts/clean-test-data.mjs`：默认只演练（列出将删的账号与行），`--apply` 才执行；KEEP 分两层——硬编码的产品账号（demo / 所有者 / dev）+ 运行时从 `.probe.json` / `.learn.json` / `.empty.json` 读出的**浏览器套件登录用夹具**，两者都永不删除；先校验 KEEP 与探针模式无交集，否则拒绝运行；只匹配已知探针模式，单事务删除 | 演练 → 执行：`users 25 → 3`、`information 38 → 19`、剩余探针账号 **0**；保留账号的 19 行一条未动。另修了脚本自身的两个坑：SQL `LIKE 'iso_%'` 里的 `_` 是单字符通配符，会误配 `isoask_…`，已显式转义；第一版没保护夹具，删掉了 `brief-verify` 登录用的 `brief-probe-*`，套件死在 `waiting for locator('header')`——夹具已重建，排除逻辑已补上，之后再跑一次确认门禁生效（`users 7 → 5`、`information 27 → 23`、`protected fixtures: brief-probe-…, dev-learn-…, empty-probe-…`） |

**本轮收口**：第三批四条（#13 / #14 / #15 / #16）全部落地，回归门禁一次全绿——后端 **299/299**、tsc 0、eslint 0、**vitest 87/87**、`next build` exit 0、`learn-verify` **23/23**、`brief-verify` **51/51**、`inbox-verify` **10/10**、`empty-account-verify` **27/27**、`dedup-verify` **7/7**、`quick-login-verify` **5/5**、`brief-fonts` **12/12**、i18n **520 键同步**。

**仍未修（下一步）**：#4 演示数据走真实管线、#12 通知 payload 带 top signals。这两项都不是缺陷，是「演示与真实不一致」的遗留面——#4 需要把种子脚本改成走真实 API 管线（会引入模型调用成本与不确定性），#12 需要先定下前端如何展开通知里的信号列表，因此单独作为下一轮。

## P0 — 会让用户直接判定「这系统不准」

| # | 问题 | 证据 | 建议 | 工作量 |
|---|---|---|---|---|
| 1 | **「为什么重要」是英文关键词模板**，不是 AI 生成 | `RelevanceService.java:64/72/84` 硬编码 `"Matches your goal: " + g`、`"Not clearly matched to your current context."`。库里真实产出的理由：`Matches your goal: Example Matches your interest: examples` | 让 `why` 走一次 LLM（输入=标题+摘要+用户目标/兴趣），失败才降级；降级文案改为 i18n key 由前端渲染，后端不产出自然语言 | 中（0.5–1 天） |
| 2 | **signal_score 两套尺度混在同一列** | 后端 `SignalScoreCalculator.MAX_SCORE = 100`、阈值 `app.signal.min-score:70`；种子脚本写 `0.96`；前端 `ScoreRing` 按 `/100` 渲染、tone 阈值 80/60。库中同时存在 `0.96` 与 `75.30` | 统一 0–100：种子脚本改分数、加 DB `CHECK (signal_score BETWEEN 0 AND 100)`、API 入口校验、前端 `ScoreRing` 加注释断言 | 小（0.5 天） |
| 3 | **语义去重是死代码** | `SemanticDedupService` 全仓**无任何调用方**；实际只有 URL 级去重（`IngestionPersister`）。README 宣称「Exact + semantic dedup」 | 接进 `IngestionPersister`（同用户内、同源或跨源比对 embedding，阈值 0.85）；或先改文档如实描述为「URL 级 + 标题级」 | 中（1 天） |
| 4 | **演示账号数据绕过真实管线** | 账号 17 条信息 → 17 条信号（100% 转化），而真实阈值 70/100 会砍掉一批。与「只留高价值」的主张自相矛盾 | 种子脚本改为**走真实 API 管线**（POST information → 触发理解/评分 → 让系统自己决定哪些成信号），只保留少量人工兜底 | 中（0.5–1 天） |

## P1 — 核心流程断掉（收件箱三件套）

| # | 问题 | 证据 | 建议 | 工作量 |
|---|---|---|---|---|
| 5 | **「忽略」不落库**，刷新即复活 | `inbox/page.tsx:32,40-47`：`useState<Set>` 本地隐藏；文案自己承认 `localOnly: "已本地忽略 {count} 条（归档将在后续版本同步到后端）"` | 加 `PATCH /api/v1/information/{id}` 或 `POST /{id}/archive`，乐观更新 + 失败回滚 | 小–中（0.5 天） |
| 6 | **「AI 过滤」栏永远是 0 条** | `inbox/page.tsx:124` `filteredCount({ count: 0 })` 硬编码；内容永远是占位文案 | 后端按 relevance/score 阈值返回被过滤项，或直接删掉这一栏（宁缺勿假） | 小（0.5 天） |
| 7 | **「生成信号」只跳详情页，不生成；「保留」什么都不做** | `inbox/page.tsx:43-46`：`signal` → `router.push`，`keep` → 注释「it is already kept」 | 调真实 `POST /signals`（可带 `informationId`）；`keep` 落一个 `KEPT` 状态 | 中（1 天） |
| 8 | **所有条目都在「需要处理」**，没有真实分组 | `items` 就是全部 inbox items，三个 section 没有分类逻辑 | 按 `hasSignal` / `relevance` 分组 | 小（0.5 天） |

## P2 — 本地化与 AI 文案

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 9 | **晨报标题硬编码英文** | `BriefService.java:82` `"Daily brief: " + signalCount + " signals"` → 中文界面出现英文标题 | 标题走 i18n key + 参数，前端渲染 |
| 10 | **工具目录 8 条描述全英文** | `/ai` 截图：`Create a new goal for the user.` / `Archive one of the user's information items...` | 工具描述加 i18n（`Agent.tool.addGoal.desc` 等），工具名保留标识符 |
| 11 | **通知文案存的是渲染后的字符串** | DB：`晨报 · 今天值得你花 20 分钟的三件事`、`需要行动 · Raft 精读已标记重要` | 存 `type + params`，渲染在客户端；否则英文界面永远看到中文 |
| 12 | **通知 payload 只有计数** | `{"informationCount":17,"signalCount":17,"actionRequired":2}` | payload 带上 top signals 的 id/title，便于前端展开 |

## P3 — 体验打磨

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 13 | **知识页首屏是空白表单**（245 字符） | 截图 `knowledge.png`：只有一个搜索框 + 4 个下拉 | 首屏加语料统计（文档数/块数/索引时间）、3 个示例问题、最近查询 |
| 14 | **收件箱不显示来源名称** | 行尾只有 `ARTICLE 2026/10/17` | 显示源名 + 域名，便于判断可信度 |
| 15 | **测试数据残留在库里** | `ai-check.txt` / `hybrid-e2e.txt` / `rerank-e2e.txt` / `Example Domain`；4 个 `brief-probe-*` 探针账号 | 加清理脚本；E2E 数据打 `@e2e` 标记，列表默认过滤 |
| 16 | **AI 页历史运行有空的测试跑** | `/ai` 截图：「历史运行 · 已完成 · github内容」 | 同上，随测试数据一起清 |

## 建议先做哪三件

1. **统一 signal_score 尺度（#2）**——半天，立刻消除「分数看起来乱」的第一印象。
2. **「为什么重要」改 LLM 生成 + 降级走 i18n（#1）**——这是「AI 内容生成不好」的最大来源。
3. **收件箱忽略/保留落库（#5/#7）**——triage 是核心动作，现在点完刷新就白点了。

做完这三件，再谈去重接线（#3）与演示数据走真实管线（#4）。

## 已排除的误判（避免误导）

- **重复信号不是产品 bug**：库里 4 份「pgvector 0.8」来自 4 个 `brief-probe-*` 探针账号各自被灌了同一份种子，程序员账号本身 17/17 无重复。真正的缺口是跨源去重没接线（#3）。
- **AI 确实在跑真实模型**：`.env` 里是 ModelScope / DeepSeek-V4.1-Flash + qwen3.7 embedding/rerank，不是 Mock。
- **今日页视觉没问题**：版式、字阶、信息层级都成立，问题在数据与文案，不在设计。
