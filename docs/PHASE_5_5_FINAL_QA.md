# Phase 5.5 Final QA Report — Frontend Experience (Direction A「信号控制台」)

> Template: Scope / 变更 / 测试结果 / 运行验证 / 已知问题 / 未验证项 / 冻结结论.
> Evidence: `docs/RUNTIME_VERIFICATION.md` (rows 11–25), `docs/ROADMAP.md` (S0–S5), git log.

## Scope

S0–S5 六阶段（见 `docs/UI_DESIGN_PLAN.md` 方向 A）：设计原型 → tokens → 组件 → 页面（P0 三屏 + P1 五页 + P2 a11y）→ 浏览器验证 → 响应式 + 全状态。

- **In**: Today 信号控制台、Signal Card、Information Detail、Auth 分屏、Landing 满版、AppShell/导航、inbox/sources/onboarding/settings、Motion/发光体系、focus/对比度、1024/768/390 响应式、空/加载/错误态截图板。
- **Out**: Phase 6–8 功能、抽屉式移动导航（偏差记录：底栏+顶栏承担）、sparkline 时间序列（API 无时间戳，CountUp+占比条替代）、跨浏览器/读屏。

前置：P0 Hardening H1–H6 ✅（`cb0242b`→`7107beb`），本阶段未改动任何后端/逻辑代码（仅 frontend UI + docs）。

## 变更（Changed）

| Stage | Commit | 内容 |
|---|---|---|
| S1 tokens | `e350e09` | `design-tokens/tokens.css` 方向 A 全量 + `@theme` 映射 + 三字体 |
| S2 components | `aaf54cd` | Button/Input/Select/EmptyState/CountUp + signal-pulse + glow（vitest 16/16） |
| S3 P0 | `a227ea1` | today 控制台（56px JetBrains Mono 指标、占比条）、分屏 auth、满版 landing、AuthGuard 水合修复、i18n |
| S3 P1 | `50b99ef` | Sidebar 品牌/脉冲、移动顶栏、InboxItem 新鲜度点、SourceCard 主卡、onboarding 步进器+TagInput、settings 图标轨、i18n 键 |
| S3 P2 | （并入 S4 提交前） | 对比度 9 组 ≥4.5:1、`@layer base` 统一 focus-visible（防双环） |
| S4 | `5a2838d` | 16 路由走查 + UI 数据链路实测、`useDiscover` 本地兜底（消 500）、ROADMAP/RUNTIME_VERIFICATION 同步 |
| S5 | 本次 | 响应式 18 组走查 + 8 态截图 + `ui-design-runs/s5-board.html` 对比板、文档收尾 |

## 测试结果（最终门，2026-10-07）

| Check | Command | Result |
|---|---|---|
| Frontend lint | `npm run lint` | ✅ 0 errors / 0 warnings |
| Type check | `npx tsc --noEmit` | ✅ 0 |
| Unit (frontend) | `npx vitest run` | ✅ 16/16 (3 files) |
| Build | `npm run build` | ✅ exit 0 |
| Backend（P0 基线，未回退） | `./mvnw -B verify` | ✅ 55/55 |
| E2E API（P0 基线，未回退） | `scripts/e2e-smoke.ps1` | ✅ 29/29 |

## 运行验证（Runtime Verified）

- **S4**: 16 路由 h1 全渲染（zh+en）+ console 0 错；真实数据链路（建源→同步 20 条→inbox 20 行→详情页）；方向 A token/focus/对比度 computed 实测（RV 11–22）。
- **S5 响应式**: 1024×800 / 768×1024 / 390×844 × 6 页 = **18/18 无横向溢出**（`scrollWidth == innerWidth`）；断点 DOM 实证 — ≥768 侧栏 224px + 顶栏/底栏 `display:none`，<768 反之（RV 23）。
- **S5 状态**: fetch 补丁（delay/reject GET /api）+ 临时账号 B — today-loading（4 骨架）、today/inbox/sources-empty、today/inbox/sources-error、login-error（401 内联）共 8 态；补丁解除后恢复实证；A 账号 tokens 还原后 inbox 回到 20 行（RV 24–25）。
- **产物**: `ui-design-runs/s5-shots/`（26 张）+ `ui-design-runs/s5-board.html`（gitignored，本地板）。

## 已知问题 / 已记录偏差

- `hnrss.org` 首连偶发 JVM 超时 → 重试即成功（环境网络，非代码）。
- 详情页/阅读正文等富文本无截断风险点已走查；`Read` 工具截图媒体串档 → 视觉验证以 DOM 断言为准，截图仅留档。
- 设计偏差（与设计稿差异，均已在 ROADMAP「已记录偏差」段）：无时间序列 → CountUp+占比条；无读/未读 → 新鲜度点；移动端无抽屉 → 底栏+顶栏；focus ring 用 signal 2px；`useDiscover` 本地兜底（`/api/v1/discover` 为 Phase 6 计划端点）。
- login 页品牌场+表单双 h1（HTML5 可接受，非渲染故障）。

## 未验证项（Not Verified）

- 跨浏览器（Firefox/WebKit）与读屏（screen reader）走查。
- 真实 AI Provider 响应（范围锁定 Mock AI）。
- 超窄屏（<375）与超宽（>1440）——1440/1024/768/390/375 已覆盖。
- 移动端真机触摸交互（浏览器模拟视口 only）。
- Phase 6/7/8 全部范围。

## 冻结结论

**PHASE 5.5 — FROZEN (2026-10-07)**。S0–S5 全部完成并通过最终四门（lint/tsc/vitest/build）+ 浏览器运行验证；后续仅接受 bugfix，不加功能。遗留 backlog 归 Phase 6（`/api/v1/discover` 端点、Information 归档动作，见 ROADMAP）。
