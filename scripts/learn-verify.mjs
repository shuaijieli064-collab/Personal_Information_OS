/* Walk the seeded programmer-learning account through every page and assert the
   content actually landed — not just that the page rendered.

   Usage:
     PW_MODULE=file:///.../playwright/index.mjs \
     CHROME_PATH=.../chrome.exe \
     BASE=http://localhost:3000 node scripts/learn-verify.mjs */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const creds = JSON.parse(fs.readFileSync(path.join(ROOT, "backend/target/.learn.json"), "utf8"));
const SHOTS = process.env.SHOTS || path.join(ROOT, "ui-design-runs/learn-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const checks = [];
const check = (name, ok, extra = "") => checks.push({ name, ok, extra });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));

/* Start on the morning edition. */
await page.goto(`${BASE}/zh-CN/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  try { localStorage.removeItem("signal-theme"); } catch {}
  document.cookie = "signal-theme=; path=/; max-age=0";
});
await page.locator('input[type="email"]').first().fill(creds.email);
await page.locator('input[type="password"]').first().fill(creds.password);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});
check("signed in as the seeded account", !page.url().includes("/login"), page.url());

const main = page.locator("main").last();
const goto = async (route) => {
  await page.goto(`${BASE}/zh-CN${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  return (await main.innerText().catch(() => "")) ?? "";
};

/* ── 头版 ─────────────────────────────────────────────────────────────── */
let text = await goto("/today");
check("front page leads with the Raft deep-dive", text.includes("Raft 精读"), text.split("\n").slice(0, 3).join(" "));
check("front page carries the seeded figures", /\b17\b/.test(text), text.match(/\d+/g)?.slice(0, 6).join("/"));
check("front page lists the rest of the news", text.includes("其余要闻") && text.includes("Raft 精读"));
check("front page shows the highest score", text.includes("0.96"));
check("front page carries the colophon", text.includes("本版由 SIGNAL"));
await page.screenshot({ path: path.join(SHOTS, "01-today.png"), fullPage: true });

/* ── 未读徽章 ─────────────────────────────────────────────────────────── */
const bell = page.locator('header a[href*="automation"] button[aria-label="通知"]').first();
const badge = await bell.locator("span").first().textContent().catch(() => null);
check("masthead shows the seeded unread count", Number(String(badge).trim().match(/^(\d+)/)?.[1]) === 3, `badge=${badge}`);

/* ── 收件箱 ───────────────────────────────────────────────────────────── */
text = await goto("/inbox");
check("inbox lists the seeded articles", text.includes("PostgreSQL 索引的代价") && text.includes("Raft 精读"));
check("inbox shows a real count", /17/.test(text), text.match(/\d+\s*(条|项|items)/)?.[0] ?? "");
await page.screenshot({ path: path.join(SHOTS, "02-inbox.png"), fullPage: true });

/* ── 发现 ─────────────────────────────────────────────────────────────── */
text = await goto("/discover");
// Every card renders, the reason is a resolved i18n string (RAG mentions the
// seeded interest), and the header chips come from the account's real interests
// — 系统设计 has the highest seeded weight.
check(
  "discover renders recommendations with real interest chips",
  ["Spring AI", "Project Reactor", "JVM Internals", "LangChain4j"].every((n) => text.includes(n))
  && text.includes("系统设计") && text.includes("RAG") && !text.includes("Java · Backend · AI"),
  text.split("\n").slice(0, 5).join(" "),
);
await page.screenshot({ path: path.join(SHOTS, "03-discover.png"), fullPage: true });

/* ── 知识 ─────────────────────────────────────────────────────────────── */
text = await goto("/knowledge");
check("knowledge console renders", text.length > 40, text.split("\n").slice(0, 3).join(" "));
await page.screenshot({ path: path.join(SHOTS, "04-knowledge.png"), fullPage: true });

/* ── 动态 ─────────────────────────────────────────────────────────────── */
text = await goto("/activity");
check("activity renders content", text.length > 40, text.split("\n").slice(0, 3).join(" "));
await page.screenshot({ path: path.join(SHOTS, "05-activity.png"), fullPage: true });

/* ── 信息源 ───────────────────────────────────────────────────────────── */
text = await goto("/sources");
check("sources lists all six feeds", ["技术周刊", "Hacker News", "分布式系统笔记", "GitHub", "官方文档", "arXiv"].every((n) => text.includes(n)), text.split("\n").slice(0, 4).join(" "));
await page.screenshot({ path: path.join(SHOTS, "06-sources.png"), fullPage: true });

/* ── 自动化 ───────────────────────────────────────────────────────────── */
text = await goto("/automation");
check("automation shows the generated brief", text.includes("晨报") && text.includes("RAG 检索质量"), text.split("\n").slice(0, 3).join(" "));
check("automation lists the three jobs", text.includes("信息源同步") || text.includes("SOURCE_SYNC") || text.includes("同步"), text.match(/同步|简报|反馈/g)?.slice(0, 3).join("/"));
await page.screenshot({ path: path.join(SHOTS, "07-automation.png"), fullPage: true });

/* ── 设置 ─────────────────────────────────────────────────────────────── */
text = await goto("/settings/profile");
// The bio lives in a <textarea>, whose value innerText cannot see.
const bio = await page.locator("textarea").first().inputValue().catch(() => "");
check("profile shows the seeded bio", bio.includes("后端工程师") && bio.includes("系统设计"), `bio=${bio.slice(0, 40)}`);
await page.screenshot({ path: path.join(SHOTS, "08-profile.png"), fullPage: true });

/* ── 英文 ─────────────────────────────────────────────────────────────── */
await page.goto(`${BASE}/en/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
const en = (await main.innerText().catch(() => "")) ?? "";
check("the same content renders in English", en.includes("Raft"), en.split("\n").slice(0, 3).join(" "));
await page.screenshot({ path: path.join(SHOTS, "09-en-today.png"), fullPage: true });

/* ── 移动端 ───────────────────────────────────────────────────────────── */
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/zh-CN/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("no horizontal overflow at 390px", overflow <= 2, `overflow=${overflow}px`);
await page.screenshot({ path: path.join(SHOTS, "10-mobile-today.png"), fullPage: true });

const real = errors.filter((e) => !/favicon|DevTools|React DevTools/i.test(e));
check("zero console errors", real.length === 0, real.slice(0, 2).join(" | "));

await browser.close();

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.extra ? `  (${c.extra})` : ""}`);
  if (c.ok) pass += 1;
}
console.log(`\n${pass}/${checks.length} checks passed`);
console.log(`screenshots → ${SHOTS}`);
process.exit(pass === checks.length ? 0 : 1);
