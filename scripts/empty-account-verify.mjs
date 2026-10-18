/* Walk a brand-new, empty account through the whole system — first run, no seed data.
 *
 * The seeded walkthroughs prove the pages render data. This one proves the other
 * half: what a user who has *nothing* sees. An empty account is the state every
 * real user starts in, and it is where blank pages, 500s and lying headings hide.
 *
 * Journey:
 *   1. register a fresh account through the real API
 *   2. assert it is actually empty (counts are zero) before anything is rendered
 *   3. sign in through the real login form
 *   4. walk every route: empty-state copy, an <h1>, zero 5xx, zero console errors
 *   5. complete the onboarding wizard (goal → interests → skills) through the UI
 *   6. import the first article; it must become the first Signal and the /today lead
 *   7. import a second, off-goal article; it must NOT become a signal, and clicking
 *      分析 must report the real score without pretending a signal was created
 *   8. no horizontal overflow at 390px
 *
 * Run:  PW_MODULE=file:///.../playwright/index.mjs \
 *       CHROME_PATH=.../chrome.exe \
 *       node scripts/empty-account-verify.mjs
 * The script prints the psql command to remove the probe account when finished.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const API = process.env.API || "http://127.0.0.1:8080";
const BASE = process.env.BASE || "http://localhost:3000";
const PG = process.env.PG_CONTAINER || "signal-postgres";
const SHOTS = process.env.SHOTS || path.join(ROOT, "ui-design-runs/empty-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${url}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/* ── 1. a genuinely new account ─────────────────────────────────────────── */
const stamp = Date.now().toString(36);
const email = `empty-probe-${stamp}@example.com`;
const password = `empty-${Math.random().toString(36).slice(2, 10)}-${stamp.slice(-4)}`;

const reg = await call("POST", "/api/v1/auth/register", {
  body: { email, password, displayName: "空账号探针" },
});
check("a fresh account registers through the real API", reg.json?.success === true, `http=${reg.status}`);
if (reg.json?.success !== true) {
  console.log(JSON.stringify(reg.json).slice(0, 300));
  await browser.close();
  process.exit(1);
}
const token = reg.json.data.accessToken;
fs.writeFileSync(path.join(ROOT, "backend/target/.empty.json"), JSON.stringify({ email, password }, null, 2));

/* ── 2. it is empty before we look at anything ──────────────────────────── */
const before = await call("GET", "/api/v1/today", { token });
const b = before.json?.data ?? {};
check(
  "the new account holds no data at all",
  b.informationCount === 0 && b.signalCount === 0 && (b.signals ?? []).length === 0,
  `information=${b.informationCount} signals=${b.signalCount}`,
);

/* ── 3. sign in through the real form ───────────────────────────────────── */
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const serverErrors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
page.on("response", (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url().slice(0, 90)}`); });

await page.goto(`${BASE}/zh-CN/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});
check("the fresh account signs in through the login form", !page.url().includes("/login"), page.url());

const main = page.locator("main").last();
const goto = async (route, wait = 2600) => {
  await page.goto(`${BASE}/zh-CN${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
  return (await main.innerText().catch(() => "")) ?? "";
};

/* ── 4. every route, empty ──────────────────────────────────────────────── */
const ROUTES = [
  ["/today", "暂时还没有信号。"],
  ["/inbox", "你的信号很安静。"],
  ["/discover", "完善你的目标与兴趣后，这里会更懂你"],
  ["/knowledge", "在你的语料上检索与问答"],
  ["/activity", "还没有信号活动。"],
  ["/sources", "你的信号很安静。"],
  ["/automation", "调度器替你做的每一件事"],
  ["/settings/profile", "个人资料"],
  ["/onboarding", "你的信号已就绪。"],
];
for (const [route, needle] of ROUTES) {
  const text = await goto(route);
  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  check(`${route} renders for an empty account`, text.includes(needle) && (h1 ?? "").trim().length > 0, `h1=${(h1 ?? "").slice(0, 14)}`);
  await page.screenshot({ path: path.join(SHOTS, `01-empty${route.replace(/\//g, "-")}.png`), fullPage: true });
}
check("no 5xx anywhere in the empty walk", serverErrors.length === 0, serverErrors.slice(0, 2).join(" | "));
check("zero console errors in the empty walk", errors.length === 0, errors.slice(0, 2).join(" | "));

/* ── 5. onboarding, through the wizard ───────────────────────────────────── */
const GOAL = "Raft 共识算法";
await goto("/onboarding", 1200);
await page.locator("input").first().fill(GOAL);
await page.getByRole("button", { name: "下一步" }).click();
await page.waitForTimeout(400);
const tagInputs = page.locator("input");
await tagInputs.last().fill("分布式系统");
await tagInputs.last().press("Enter");
await tagInputs.last().fill("共识算法");
await tagInputs.last().press("Enter");
await page.getByRole("button", { name: "下一步" }).click();
await page.waitForTimeout(400);
await tagInputs.last().fill("Java");
await tagInputs.last().press("Enter");
await page.getByRole("button", { name: "完成设置" }).click();
await page.waitForURL((u) => u.pathname.includes("/today"), { timeout: 20000 }).catch(() => {});
check("onboarding lands on the front page", page.url().includes("/today"), page.url());

const goals = await call("GET", "/api/v1/goals", { token });
const goalTitles = (goals.json?.data?.items ?? goals.json?.data ?? []).map((g) => g.title);
check("the goal from the wizard is persisted", goalTitles.includes(GOAL), goalTitles.join("/") || "none");

/* ── 6. the first article becomes the first Signal ───────────────────────── */
// Relevance is a literal substring match against the goal/interests, so the
// goal title and both interests must really appear in the body below.
const ON_GOAL = `# Raft 共识算法到底在解决什么问题

Raft 共识算法把分布式系统里最麻烦的事情——让一组机器对同一个值达成一致——拆成三个
可以分开推理的子问题：领导者选举、日志复制、安全性约束。

**领导者选举**。每个 follower 持有一个随机化的选举超时。超时先到的那台成为候选人，
向其他节点拉票；拿到多数票即成为领导者，之后所有写请求都由领导者接收。

**日志复制**。领导者把每条记录追加到自己的日志，再并行发给 follower，等多数节点
确认落盘后才向客户端返回成功。多数派（quorum）是Raft 共识算法容错的关键：
三台机器容忍一台故障，五台容忍两台。

**安全性**。Raft 用一条选举限制保证已提交的记录不会丢：候选人必须拥有至少和
多数派一样新的日志，才有资格当选。

工程上最常见的错误是把Raft 共识算法当成"只要多数派活着就一定不丢数据"——如果
领导者确认了却没能把提交信息广播出去，这条记录依然会被后续的领导者覆盖。
判断一个共识实现是否可靠，要看它对"提交"的定义，而不是看它实现了多少次选举。

实践中建议直接读一遍 Raft 论文的图 2，再对照 etcd 的源码看选举超时和心跳的具体
取值；分布式系统的共识问题没有捷径，但 Raft 已经是最贴近工程直觉的那一个。
`;

const OFF_GOAL = `# 红烧肉的家常做法

五花肉切块后冷水下锅，加姜片和料酒焯水，捞出沥干。锅里放少许油，下冰糖小火炒出
糖色，倒入肉块翻炒至表面上色，加八角、桂皮、香叶、葱姜炒香。

加入生抽、老抽、料酒和热水，没过肉面，大火烧开后转小火炖 45 分钟，最后大火收汁。
讲究一点的可以改用砂锅，或者加一个煮好的鸡蛋同炖，吸满汤汁后比肉还受欢迎。
`;

async function importArticle(title, body) {
  const form = new FormData();
  form.append("file", new Blob([body], { type: "text/markdown" }), title);
  const r = await call("POST", "/api/v1/import/file", { token, form });
  return r;
}

const r1 = await importArticle("Raft 精读.md", ON_GOAL);
check("the first article imports", r1.json?.success === true, `http=${r1.status}`);

let today = await goto("/today", 2600);
const signals = await call("GET", "/api/v1/signals?size=50", { token });
const all = signals.json?.data?.items ?? [];
check(
  "the first article becomes the first Signal",
  all.length === 1,
  `${all.length} signal(s) · scores ${all.map((s) => Math.round(s.signalScore)).join(",") || "none"}`,
);
check(
  "the front page leads with the first Signal",
  today.includes("Raft") && /score\s*\d+/.test(today),
  today.match(/score[^\n]{0,8}/)?.[0],
);
await page.screenshot({ path: path.join(SHOTS, "02-first-signal.png"), fullPage: true });

/* ── 7. an off-goal article must not become a Signal ────────────────────── */
const r2 = await importArticle("红烧肉的家常做法.md", OFF_GOAL);
check("the second article imports", r2.json?.success === true, `http=${r2.status}`);

let inbox = await goto("/inbox", 2600);
check(
  "the off-goal article waits in 需要处理 instead of becoming a Signal",
  inbox.includes("需要处理") && inbox.includes("红烧肉"),
  inbox.split("\n").slice(0, 4).join(" ").slice(0, 80),
);

// 分析 must report the score the pipeline actually computed, and must not
// invent a signal for a below-threshold item.
await page.getByRole("button", { name: "分析" }).first().click().catch(() => {});
const notice = page.locator("p", { hasText: /信号分/ }).first();
let scoreShown = null;
for (let i = 0; i < 45; i++) {
  const txt = await notice.textContent().catch(() => "");
  const m = txt.match(/信号分\s*(\d+)/);
  if (m) { scoreShown = Number(m[1]); break; }
  await page.waitForTimeout(2000);
}
check("分析 reports the real score", scoreShown != null, `score=${scoreShown}`);
check(
  "and the off-goal item still did not become a Signal",
  scoreShown != null && scoreShown < 70,
  `score=${scoreShown} vs threshold 70`,
);
inbox = await goto("/inbox", 2600);
check(
  "the inbox now sections the two items honestly",
  inbox.includes("已生成信号") && inbox.includes("红烧肉"),
  `sections: ${inbox.includes("已生成信号") ? "signal ✓" : "signal ✗"}`,
);
await page.screenshot({ path: path.join(SHOTS, "03-inbox-after-first-signal.png"), fullPage: true });

/* ── 8. mobile holds up ─────────────────────────────────────────────────── */
await page.setViewportSize({ width: 390, height: 844 });
await goto("/today", 2200);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("no horizontal overflow at 390px", overflow <= 2, `overflow=${overflow}px`);
await page.screenshot({ path: path.join(SHOTS, "04-mobile-today.png"), fullPage: true });

check("still zero console errors at the end", errors.length === 0, errors.slice(0, 2).join(" | "));
check("still no 5xx at the end", serverErrors.length === 0, serverErrors.slice(0, 2).join(" | "));

await browser.close();

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  if (c.ok) pass += 1;
}
console.log(`\n${pass}/${checks.length} checks passed`);
console.log(`screenshots → ${SHOTS}`);
console.log(`probe account: ${email}`);
console.log(
  `\nclean up: docker exec -i ${PG} psql -U signal -d signal -c "DELETE FROM users WHERE email = '${email}'"`,
);
process.exit(pass === checks.length ? 0 : 1);
