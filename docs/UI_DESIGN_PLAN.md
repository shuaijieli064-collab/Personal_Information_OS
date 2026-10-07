# SIGNAL 前端 — 设计升级规划

> 状态：**待确认方向**（决策点见 §6）
> 生成时间：2026-10-05 · 基于现有 `frontend/design-tokens/tokens.css`、12 页路由与
> `docs/FRONTEND_PLAN.md` 执行结果的核查，以及 doubao-ui-design 工艺标准（得奖机制 /
> 字阶圆角区间 / dashboard 配色库 / 审美基线 / 工作台评分细则）的对照。

---

## 1. 现状诊断：为什么"看起来太简单"

| # | 问题 | 现状 | 工艺标准对照 |
|---|---|---|---|
| 1 | **字阶无断崖** | tokens 无字号 scale；全站 `text-sm/base`，标题≈正文 1.5–2 倍 | 参考库 H1÷正文 中位 **3.6**；至少一处 ≥96px 或 ≥40px 数据主角 |
| 2 | **底色是纯黑** | `--bg-0: #050505` 纯灰黑 | 深色底必须**带色相**：蓝黑/墨绿/暖炭/冷炭（L 6–14 带色相） |
| 3 | **中性阶纯灰无微染** | bg 0–3 纯灰阶梯 | dashboard 中性阶必须**带微染**（冷石板/靛染…），纯灰=扁平廉价 |
| 4 | **圆角无角色分工** | 6 / 10 / 14 中等统一 | 应 4 角色：shell 28–44 / card 14–24 / control 8–12 / pill 999；shell 与 card 差 ≥12px |
| 5 | **字体单一** | 全站 Inter/Geist 同族同粗细 | display 与 body 需异质配对（几何/超粗 ↔ 人文）+ mono 数字 |
| 6 | **层次扁平** | 全页背景+等大卡片同一平面 | 需叠压/尺度变化/密度变化/关系网格至少一种机制 |
| 7 | **等大卡片阵列** | inbox/sources 全等分列表 | 卡片应**尺寸不等、有主次**（得奖机制 M4） |
| 8 | **无影像/质感层** | 全 CSS，零真实资产 | 得奖机制 M6：真实影像或真实渲染 |
| 9 | **数据无可视化** | today 三个数字干巴巴 | 工作台评分：数据须配图表（趋势/分布），纯罗列是扣分项 |
| 10 | **无 signature motion** | 业务页静态；动效全在 motion-demo | 须 1 个主打动效（数字滚动/信号脉冲）+ hover/press/focus/loading 反馈 |
| 11 | **强调色职责漂移** | signal 蓝同时用于按钮/链接/active 多处 | accent 出现类别 ≤2；`#4d9dff` 接近 Tailwind blue 默认系 |
| 12 | **无图标系统** | 导航/按钮纯文字 | 导航位用通用描边图标集=模板感；须设计决定的图标（Phosphor） |

**结论：不是"再精致一点"能补的差距，是机制层的差距** —— 字阶、底色、中性阶、圆角角色、
字体配对、层次机制、数据可视化、主打动效这 8 项共同缺位，叠加起来就是"像裸 HTML / Bootstrap 模板"。

---

## 2. 设计方向提案

### 方向 A：信号控制台（推荐）—— 深场信息工作台

产品定位映射：**"个人信息操作系统"= 把信息压缩为信号**，天然适合深场数据工作台。
直接套用 dashboard 配色库中碰撞验证过的**「石板深控制台」**套装并做 SIGNAL 品牌化：

| 组 | 规划值 | 说明 |
|---|---|---|
| 底色 | `--page #0C0F14`（蓝黑微染，非纯黑） | 带色相的深场，L≈8 |
| 面板 | 卡 `#1A1F27` / 内嵌 `#242B36` | 暗色"面板越前越亮" |
| 文字 | ink-1 `#F4F6F8` / ink-2 `#B8C2CE` / ink-3 `#8A97A8` | 三级墨，ink-3 对卡面 ≥4.5:1 |
| 强调 | indigo `#7B77F0`（暗值）+ 青 `#3FC5E8` 做第二序列（图表） | 非默认蓝；靛+青同族，图表不用第三色 |
| 字阶 | display 44–56（数据主角）/ H1 28–32 / H2 20 / body 15–16 / meta 12 大写 | 断崖 ≥2.8；today 三指标用巨型数字 |
| 字体 | display `Space Grotesk` + body `Inter`/Geist + 数字 `JetBrains Mono` | 几何 display 异质配对 + mono 技术语义 |
| 圆角 | shell 28 / card 16 / control 10 / pill 999 | 4 角色分工，可点性=圆形 |
| 层次 | 卡内叠压（发光）、today 关系网格、inbox 密度分级 | 摆脱单平面 |
| 质感 | 极淡噪点纹理 + 信号波形 SVG 主视觉 + 卡片内高光（inset 白线） | 替代纯 CSS 平面 |
| 图标 | Phosphor（regular 单一字重），导航/状态位统一 | 设计决定的图标系统 |
| 动效 | **数字滚动**（三指标）+ 信号脉冲（active 导航/新信号）+ 刷新旋转 | 一个 signature motion 贯穿业务页 |

### 方向 B：极简编辑（备选）—— 声明式克制

保持极简但做"有设计感的极简"：巨型字号 + 规则线 + 留白建立秩序（瑞士风格），
声明 `type-led / pure-canvas` 豁免影像与底色限制。数据用排版而非图表。
**风险**：与当前差距较小，用户已表达"太简单"，可能不满足。

> 推荐 **A**：SIGNAL 的差异化就在于"深场信号工作台"，方向 A 一次性补齐 8 项机制缺位，
> 且 `docs/ROADMAP.md` 后续还有数字孪生/知识图谱可视化要长在这个设计系统上。

---

## 3. 设计令牌升级（tokens.css 五组数值）

```css
/* 色板 —— 冷石板微染（深场）+ 靛 accent */
--page:#0C0F14;  --bg:#1A1F27;  --panel:#242B36;  --panel-2:#2E3642;
--border:rgba(255,255,255,.06);  --border-strong:rgba(255,255,255,.10);
--ink-1:#F4F6F8;  --ink-2:#B8C2CE;  --ink-3:#8A97A8;
--accent:#8B85FF;  --accent-2:#3FC5E8;  --accent-soft:rgba(139,133,255,.14);
--on-accent:#FFFFFF;  --glow:rgba(139,133,255,.30);
--up:#3FCB86;  --down:#F07C93;  --warn:#E8A33D;

/* 字阶 —— 断崖 ≥2.8 */
--display:clamp(2.75rem,4.5vw,3.5rem);   /* 44–56px 数据主角 */
--h1:clamp(1.75rem,2.2vw,2rem);          /* 28–32 */
--h2:1.25rem;  --body:0.9375rem;         /* 15 */
--meta:0.75rem;  /* +0.08em 大写 */

/* 圆角 —— 4 角色 */
--r-shell:28px;  --r-card:16px;  --r-control:10px;  --r-pill:9999px;

/* 阴影 —— 深场发光配方（≤3 套） */
--shadow-card:0 24px 60px -20px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);
--shadow-float:0 40px 90px -30px rgba(139,133,255,.18), inset 0 1px 0 rgba(255,255,255,.08);

/* 字体 */
--font-display:"Space Grotesk",...;  --font-mono:"JetBrains Mono",...;
```

## 4. 页面级改造清单（按优先级分组）

### P0 核心（先做，占 80% 观感）
| 页面 | 改造点 |
|---|---|
| **today（仪表板）** | 时段问候升级为标题区（display 级）；三指标卡：巨型数字 + 趋势 sparkline（SVG 手绘，不引库）+ 同比徽章；信号列表改时间线式（mono 时间戳 + 状态点 + 主次卡）；刷新按钮旋转动效；图表配色 accent/accent-2 派生 |
| **登录 / 注册** | 左品牌主视觉（信号波形 SVG + 发光渐变暗场 + 噪点），右玻璃表单卡（shell 圆角）；错误态内联样式升级 |
| **首页 /（landing）** | 满版 hero：信号主题视觉 + 巨字标题（Space Grotesk display）+ 单 CTA；CTA hover 发光；滚动揭示 |

### P1 体验（占剩余 20%）
| 页面 | 改造点 |
|---|---|
| **AppShell** | 顶栏品牌字升级 + 状态点；导航图标化（Phosphor，`aria-current` 发光态）；移动端抽屉 |
| **inbox / 详情** | 行 hover 微亮 + mono 时间戳 + 分组头 + 密度分级（读/未读状态点）；详情页主视觉区 |
| **sources** | 卡片不等分（最近同步主卡 + 其余次卡）；状态徽章（同步中 spinner / 成功 / 失败色点） |
| **onboarding** | 步进式进度条 + 当前步强调；TagInput 胶囊样式 |
| **settings** | 两栏布局（图标侧栏 + 内容区）；卡片分组标题（meta 大写） |

### P2 系统
- 统一 ui/ 组件换新 tokens（Button 主/次/ghost 三态、Input focus 发光、Spinner、EmptyState 图标化）
- 动效接入：`motion-config` 增加数字滚动组件（CountUp 升级为业务用）、信号脉冲、reduced-motion 双保险保留
- a11y：ink-3 对比度按新值复验；focus ring 用 accent-soft；键盘顺序复查

## 5. 落地路线（设计先行 → 工程落库）

| 阶段 | 内容 | 验证 |
|---|---|---|
| **S0 设计原型** | 用 doubao-ui-design 流程在 `ui-design-runs/` 工作目录先做 **today + 登录 + 首页** 三屏高保真原型（单文件 HTML），含真实界面状态（空态/加载/错误） | `ui.py review` 截图 + 真值门 + 与 gold 对照 |
| **S1 tokens** | `tokens.css` 五组数值落地 + Tailwind `@theme` 映射更新 | lint/tsc |
| **S2 组件** | ui/ 组件 + Phosphor 图标系统 + 数字滚动动效组件 | 单测 + 截图 |
| **S3 页面** | P0 三页 → P1 五页 → P2 系统 | 每页 lint/tsc/build |
| **S4 验证** | 全量 lint/tsc/test/build + 浏览器截图（改前/改后对比）+ a11y 快速扫描 | 交付对比板 |

## 6. 决策点（请拍板）

1. **方向**：A 信号控制台（推荐，深场靛紫工作台）还是 B 极简编辑，或有其他参考？
2. **范围**：全站 12 页一次到位，还是先 P0 三屏（today/login/首页）出原型确认后再铺开？
3. **图表**：today 趋势用 SVG 手绘（零依赖、风格可控）还是引入 ECharts/recharts（能力全、重）？—— 推荐手绘 sparkline 起步
4. **执行顺序**：是否先做 S0 设计原型（三屏高保真 + 方案 Doc）供确认，再落代码？
