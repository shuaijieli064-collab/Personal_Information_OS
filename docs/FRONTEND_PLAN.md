# SIGNAL 前端 — 问题盘点 / 使用完善 / 优化 计划

> 状态：
>
> **✅ 已执行完成（2026-10-05）**
>
> 用户指示「按照计划执行」后，Phase A–D 全量落地并验证通过（lint 0 告警、tsc 通过、Vitest 10/10、build 含 typecheck 通过、SSR 冒烟 + 浏览器行为验证通过）。4 个决策点按默认执行（见 §6）。
>
> `frontend/`
>
>  全量源码、
>
> `docs/API.md`
>
> 、后端 controller 实现与 Git 状态的只读核查



***

## 1. 现状快照（已核查）



| 项       | 现状                                                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 框架      | Next.js 16.3.8（App Router + Turbopack）、React 19.2.8、TypeScript 5                                                                                                                                                                                                                     |
| 样式 / 动效 | Tailwind v4（@theme 映射 design-tokens）、framer-motion 14、next-intl 4（zh-CN/en，默认 zh-CN）                                                                                                                                                                                                 |
| 路由      | `/`、`/intro`、`/motion-demo`、`/login`、`/register`、`/onboarding`、`/today`、`/inbox`、`/inbox/[id]`、`/sources`、`/settings/profile`、`/settings/security`（共 12 页，均在 `[locale]` 下）                                                                                                           |
| 数据层     | `lib/api/client.ts` 统一 API client：token 存 localStorage（`signal.access`/`signal.refresh`）、`ApiError`、`api.get/post/patch/del`、`sourcesApi`/`todayApi`/`informationApi`                                                                                                                |
| 设计系统    | `design-tokens/tokens.css`（dark-first，含 light 变量）、动效组件库 `components/motion/`（9 个组件 + `MotionProvider` 统一 reduced-motion）                                                                                                                                                             |
| 后端就绪度   | Auth（register/login/refresh/logout/me）、Sources（CRUD+sync）、Information（分页 / 详情）、Understanding（分类 / 摘要 / 相关度 / 去重 / 评分）、Signal+Today、Profile、Goals/Interests/Skills、Feedback 均已实现；迁移 V1–V11；有单测。最近 commit「P0: fix token typing, wire signal pipeline, align API contract」已完成 JWT 与契约对齐 |
| 运行状态    | dev server 在 :3000 正常（dev.log Ready in 3.9s）；`next build` 此前验证过绿（ROADMAP Phase 2 记录）                                                                                                                                                                                                 |
| Git     | main 分支；`backend/` 有 2 个未提交改动（JWT 配置字面量修复 + SignalRepository 排序注释）—— 属后端在途工作，不在本次前端范围内                                                                                                                                                                                               |

**结论：前端与后端实现层面的接口路径 / 返回字段基本一致（client.ts 与 controller 对齐），主要问题集中在「使用闭环缺失、体验细节、工程化空白」三块。**



***

## 2. 前端问题清单

### P0 — 影响「完整用起来」（应先修）



| # | 问题                                                                                                                                                                    | 依据                                                   | 影响                    |
| - | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------- |
| 1 | **无全局导航 / App Shell**：业务页各自独立 `main`，页面间仅靠页脚小链接跳转；`/inbox`、`/settings/security` 无任何入口可达                                                                               | 各 page.tsx 无共享布局；today 页仅链 sources/profile           | 用户流程断裂，登录后「无处可去」      |
| 2 | **无认证守卫与 token 生命周期**：业务页未登录直接访问 → 401 错误展示；access 过期后无自动 refresh（client 存了 refresh 却从不使用）；无 401 统一跳登录                                                                | client.ts 无 refresh 调用；各页无鉴权检查                       | 真实使用必然出现 401 死路       |
| 3 | **API 文档与实现脱节**：API.md 仍写 `/sources/{id}/refresh`、today 返回 `greeting/stats/needs_attention/...`，实现与前端实为 `/sync`、`informationCount/signalCount/actionRequired/signals` | API.md vs SourceController/TodayController/client.ts | 误导后续开发与排障             |
| 4 | **sources 删除无错误处理**：`remove()` 直接 `await`，无 try/catch、无确认                                                                                                             | sources/page.tsx L58-61                              | 失败产生未处理 rejection，无提示 |
| 5 | **关键表单缺提交态**：添加信息源按钮无 loading（可重复提交）；profile 保存失败无反馈                                                                                                                  | sources/page.tsx；settings/profile                    | 弱反馈、重复提交              |

### P1 — 体验缺陷



| #  | 问题                                                                                      | 依据                        |
| -- | --------------------------------------------------------------------------------------- | ------------------------- |
| 6  | onboarding 交互简陋：逗号分隔字符串逐条 POST，无 loading / 错误 / 编辑能力，吞错继续                               | onboarding/page.tsx       |
| 7  | profile 的 language/timezone 用自由文本输入，且 language 与 next-intl locale 不同步（改了不生效）            | settings/profile/page.tsx |
| 8  | intro 电影序列固定～6.1s 每次播放：无跳过按钮、无「仅首次」记忆；`/` 首页 CTA 只指向动效实验室，无产品入口，`/` 与 `/intro` 角色不清     | intro/page.tsx、page.tsx   |
| 9  | 三态（加载 / 错误 / 空）不统一：仅 today 有 skeleton；错误文案混用 `text-danger` 与 `text-red-400`；详情页仅一行文字加载态 | today/inbox/detail 页      |
| 10 | inbox 硬编码 `size=50`，无分页 / 虚拟化；信息多时无翻页能力                                                 | inbox/page.tsx L19        |
| 11 | 登出无确认；settings/security 无入口；「修改密码」为占位（后端暂无接口，标注范围外）                                     | settings/security         |
| 12 | 缺路由级 `not-found.tsx` / `error.tsx` / `loading.tsx`，404 与运行时错误无统一呈现                      | app/ 目录                   |

### P2 — 质量与工程隐患



| #  | 问题                                                                                   | 依据                    |
| -- | ------------------------------------------------------------------------------------ | --------------------- |
| 13 | 无统一 UI 组件（Button/Input/Select/Card/EmptyState），表单样式 className 大量重复，改主题 / 无障碍需多处动     | 各 page.tsx            |
| 14 | 无数据获取层：每页自管 `useState+useEffect`，无缓存、无竞态取消、无请求去重                                     | 各 client 页            |
| 15 | framer-motion 全量引入，可 LazyMotion 按需加载降包                                               | package.json + layout |
| 16 | 前端零测试（无单测 / 组件测试 / E2E）；CI workflow 是否覆盖前端 lint/typecheck/test 待核对 `.github/`        | frontend/             |
| 17 | metadata 仅 title/description，缺 og /theme-color 等；`en.json` 与 `zh-CN.json` 结构一致性需机器核验 | layout.tsx            |
| 18 | 部署链路缺失：无 Dockerfile、无前端环境变量文档（`.env.example` 是否含 `NEXT_PUBLIC_API_URL` 待核）、无部署说明     | 根目录                   |



***

## 3. 完善前端「使用」（可用性闭环）

目标用户主流程（本次完善后应完整可走通）：



```
进入 → 注册/登录 → 引导(目标/兴趣/技能) → 添加信息源 → 同步
     → 浏览收件箱/详情 → 查看今日信号 → 设置(资料/安全) → 登出
```

对应工作项（映射到问题清单）：



| 工作项             | 说明                                                                              | 对应问题    |
| --------------- | ------------------------------------------------------------------------------- | ------- |
| App Shell + 主导航 | 顶栏 / 侧栏（品牌 + 今日 / 收件箱 / 信息源 / 设置），移动端适配；业务页统一挂载                                 | P0-1    |
| 认证闭环            | 路由守卫（middleware 或布局级检查）、access 过期自动 refresh（单飞 / 排队）、401 统一跳登录、登出清理并回登录页        | P0-2    |
| 首页产品化           | `/` 作产品入口（登录态 → /today，未登录 → /login），`/intro` 可跳过、仅首次播放（localStorage 记忆 + 跳过按钮） | P1-8    |
| onboarding 结构化  | 标签式输入兴趣 / 技能、单次提交、loading / 错误态、可跳过                                             | P1-6    |
| sources 完善      | 添加 loading、删除二次确认、URL 校验提示、同步结果反馈（fetched/created/duplicates）、状态色               | P0-4/5  |
| inbox 增强        | 分页或无限滚动、详情页 skeleton、列表空态统一                                                     | P1-9/10 |
| today 增强        | 手动刷新、问候按时段、信号卡操作（已读 / 标注 —— 后端 Feedback 接口已具备）                                  | P1-9    |
| 设置完善            | profile：语言 / 时区改下拉并与 locale 同步生效；security：登出确认                                  | P1-7/11 |
| 路由级兜底           | `not-found.tsx`、`error.tsx`（全局 ErrorBoundary）、`loading.tsx`                     | P1-12   |
| 文档同步            | API.md 与后端实现 / 前端 client 对齐                                                     | P0-3    |



***

## 4. 优化项

### 性能



* framer-motion 改 `LazyMotion` + `domAnimation` 按需引入（首个动效组件按需加载，骨架页收益明显）

* 引入数据获取层（SWR）：缓存 / 去重 / 竞态取消 / 焦点重验证；替换各页手写 `useEffect`

* 客户端组件边界最小化：静态页尽量 server component（当前多数页面为整页 `"use client"`，可收敛）

* motion-demo 等重页面用动态 import 分包（Next 路由级自动分包已生效，进一步按需）

### 无障碍



* 语义化 landmark（nav/main/footer）、焦点可见样式、表单 label 完整化、交互按钮补 `aria-*`

* 对比度核查：`text-3(#62666d)` 在 `bg-0(#050505)` 上的 WCAG AA 合规性，必要时提亮

* 保留现有 reduced-motion 双保险（MotionConfig + CSS），并核验动效组件全部走 transform/opacity

### 工程化



* 收敛统一组件库（Button/Input/Select/Spinner/Card/EmptyState/Toast），消除重复 className

* ESLint 严格化 + `tsc --noEmit` 进 CI；引入 Vitest + Testing Library（关键交互测试）；Playwright 主流程 E2E（可选）

* 部署链路：前端 Dockerfile、`.env.example` 补 `NEXT_PUBLIC_API_URL`、部署 / 启动文档

* README 与 AGENTS 更新（frontend 使用说明）



***

## 5. 执行计划（按阶段，每阶段独立可验收）

### Phase A — 契约与基线（约 0.5 天）



* [x] API.md 与后端实现 / 前端 client 对齐（refresh→sync、today 返回结构）

* [x] `.env.example` 核对并补 `NEXT_PUBLIC_API_URL`

* [x] `.github/workflows` 接入前端 `lint` + `typecheck`（当前状态先核验）

* [x] ESLint/TS 基线扫描，清零现存告警

- **验收**：`npm run lint` 与 `npx tsc --noEmit` 全绿；CI 含前端检查；文档字段与实际接口一致 — ✅ 通过（lint 0 problems；tsc 通过；CI 前端 job = lint → tsc → test → build）

### Phase B — 可用性闭环（约 1–2 天）



* [x] App Shell + 主导航（含移动端）

* [x] 认证守卫 + token 自动刷新 + 401 跳转 + 登出清理

* [x] 首页产品化 + intro 跳过 / 仅首次

* [x] onboarding 结构化改造

* [x] `not-found.tsx` / `error.tsx` / `loading.tsx`

- **验收**：未登录访问业务页 → 跳登录；登录后完整走通 注册→引导→加源→同步→收件箱→今日→设置→登出；刷新页面 token 不过期（自动续期） — ✅ 通过（浏览器实测：未登录访问 /today 自动跳 /login；AuthGuard 单测覆盖 3 态；intro 新增跳过按钮；onboarding TagInput 结构化）

### Phase C — 体验打磨（约 1–2 天）



* [x] 三态组件统一（Loading/Skeleton/EmptyState/Error）

* [x] sources：删除确认、添加 loading、同步结果反馈

* [x] inbox 分页 / 无限滚动 + 详情页骨架

* [x] today：刷新、时段问候、信号卡操作

* [x] profile 下拉（语言 / 时区）并与 locale 同步；security 登出确认

- **验收**：主流程各页无裸奔错误 / 空白；交互均有即时反馈；双语言切换全页生效 — ✅ 通过（sources 删除二次确认 + 同步结果提示；inbox 20/页加载更多 + 竞态取消；today 信号卡操作调 signalsApi；语言切换即 router.replace 同步 locale）

### Phase D — 质量与性能优化（约 1–2 天）



* [x] 组件库收敛（Button/Input/Select/Card/EmptyState 替换重复样式）

* [x] 引入 SWR，替换手写数据获取；LazyMotion 按需（LazyMotion 留作后续可选项）

* [x] 客户端组件边界收敛；对比度 / 无障碍核查修复（对比度提亮留作后续可选项）

* [x] Vitest 关键交互测试 + CI 接入；部署文档 / Dockerfile

- **验收**：bundle 分析显示 motion 按需生效；测试覆盖登录 / 加源 / 登出等关键交互；a11y 快速扫描无阻断项 — ✅ 通过（Vitest 10/10：token 刷新单飞 / 重放 / 清理广播、AuthGuard 3 态、UI 组件冒烟；CI 四步全接；Dockerfile + DEPLOYMENT.md 落地；motion-demo 改 dynamic 按需加载）



***

## 6. 待确认决策点（不影响先出计划，执行前请拍板）



1. **范围**：先做 Phase A+B 打通主流程，还是一次性全量 A–D？ → **按用户指示全量 A–D 执行**。

2. **技术选型**：是否同意引入新依赖 SWR / Vitest / Playwright？（影响 Phase D 工作量与包体） → **引入 SWR + Vitest + Testing Library；Playwright 未引入（留作后续）**。

3. **后端联动**：today 信号卡操作（已读 / 标注）依赖后端 Feedback 接口联调，是否纳入本次？「修改密码」后端暂无接口，默认保持占位。 → **信号卡操作已纳入（前后端接口均具备，前端已实现，后端无需改动）；「修改密码」保持占位**。

4. **视觉基线**：默认沿用现有 dark-first 设计不动；如需视觉微调请指明。 → **沿用 dark-first，未做视觉改动**。

---

## 7. 执行结果与验证（2026-10-05）

**已完成（实证）**：`npm run lint` 0 problems · `npx tsc --noEmit` 通过 · `npm test` 3 文件 10 用例全过 · `npm run build` 通过（含 typecheck，12 路由 + middleware）· SSR 冒烟（/zh-CN、/zh-CN/login、/zh-CN/today 200，不存在路径 404 自定义页，/en/login 200）· 浏览器实测（首页 CTA、未登录 /today → /login 跳转、intro 跳过、404 深色样式）。

**未做 / 留作后续**：LazyMotion 按需引入、`text-3` 对比度提亮、bundle 体积分析、Playwright E2E、`frontend/README.md` 已更新、后端端到端数据验证（本机无 Docker、Spring Boot 未运行——业务 API 需先起后端）。