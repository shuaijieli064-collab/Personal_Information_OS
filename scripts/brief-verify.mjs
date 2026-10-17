// End-to-end verification of the broadsheet recast: signs in once, then walks
// every authenticated route in both locales and at two viewports, checks the
// new shell grammar (vertical rail, masthead dateline, edition switch, ⌘K),
// and fails on anything that renders nothing, overflows, or logs to console.
//
// Usage:
//   PW_MODULE=file:///.../playwright/index.mjs \
//   CHROME_PATH=.../chrome.exe \
//   BASE=http://localhost:3000 node scripts/brief-verify.mjs
import fs from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE || "playwright");

const BASE = process.env.BASE || "http://localhost:3000";
/* Credentials come from a gitignored file: an inline password on the command
   line gets rewritten by the sandbox and silently breaks every later run. */
const creds = JSON.parse(readFileSync(path.join(ROOT, "backend/target/.probe.json"), "utf8"));
const SHOTS = process.env.SHOTS || path.join(ROOT, "ui-design-runs/brief-shots");

const ROUTES = [
  "/today",
  "/inbox",
  "/discover",
  "/knowledge",
  "/ai",
  "/automation",
  "/activity",
  "/sources",
  "/settings/profile",
  "/settings/security",
];

fs.mkdirSync(SHOTS, { recursive: true });

const checks = [];
const check = (name, ok, extra = "") => checks.push({ name, ok, extra });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

// ── Sign in ───────────────────────────────────────────────────────────────
await page.goto(`${BASE}/zh-CN/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
/* Every walk starts on the morning edition. */
await page.evaluate(() => {
  try {
    localStorage.removeItem("signal-theme");
  } catch {}
  document.cookie = "signal-theme=; path=/; max-age=0";
});
await page.locator('input[type="email"]').first().fill(creds.email);
await page.locator('input[type="password"]').first().fill(creds.password);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(2500);
check("signed in", !page.url().includes("/login"), page.url());
await page.screenshot({ path: path.join(SHOTS, "01-login.png") });

const main = page.locator("main").last();

// ── Masthead: nameplate, dateline, edition mark ────────────────────────────
await page.goto(`${BASE}/zh-CN/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);

const masthead = page.locator("header").first();
const mastText = await masthead.innerText();
check("masthead carries the nameplate", mastText.includes("SIGNAL"));
check("masthead carries a dateline", /第\s*\d+\s*期/.test(mastText), mastText.split("\n").slice(1, 3).join(" "));
check("morning edition is the default", (await mastText.includes("晨版")) && mastText.includes("晨"));

const dayBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("morning edition prints on warm paper", dayBg === "rgb(246, 241, 231)", dayBg);

/* Search and notifications are icon-only controls: they carry an accessible
   name, never visible text, so `innerText` can never see them. */
const bellExists = await masthead.locator('a[href*="automation"] button[aria-label="通知"]').count();
check("masthead carries search + notifications", mastText.includes("搜索") && bellExists > 0, `bell=${bellExists}`);

const bell = masthead.locator('a[href*="automation"] button[aria-label="通知"]').first();
const badge = await bell.locator("span").first().textContent().catch(() => null);
/* The seed gives this account 2 unread notifications. The badge span also
   carries an sr-only " · 通知" suffix for screen readers, so compare the
   leading count, not the whole string. */
const badgeCount = Number(String(badge).trim().match(/^(\d+)/)?.[1] ?? NaN);
check("notification bell shows live unread count", badgeCount === 2, `badge=${badge}`);

// ── Vertical rail ─────────────────────────────────────────────────────────
const rail = page.locator("aside").first();
const railText = (await rail.textContent()) ?? "";
const railWidth = (await rail.boundingBox())?.width ?? 0;
for (const dest of ["今日", "收件箱", "发现", "知识", "自动化", "设置", "退出"]) {
  check(`vertical rail lists ${dest}`, railText.includes(dest));
}
check("rail is a narrow spine", railWidth > 60 && railWidth < 130, `width=${railWidth}`);
const vertical = await rail.locator(".vrail").first().evaluate((el) => getComputedStyle(el).writingMode);
check("rail labels run vertically", vertical.includes("vertical"), vertical);

// ── Front page grammar ────────────────────────────────────────────────────
const todayText = await main.innerText();
check("front page opens with the figures strip", todayText.includes("新增信息") && todayText.includes("需要行动"));
check("front page shows a lead story", /头条/.test(todayText) && todayText.includes("pgvector 0.8"));
check("front page carries a colophon", todayText.includes("本版由 SIGNAL"));
await page.screenshot({ path: path.join(SHOTS, "02-today.png"), fullPage: true });

// ── Command palette ───────────────────────────────────────────────────────
await page.keyboard.press("ControlOrMeta+k");
await page.waitForTimeout(900);
const palette = page.locator('[role="dialog"]').first();
check("⌘K opens the command center", (await palette.count()) > 0 && (await palette.isVisible()));
await page.screenshot({ path: path.join(SHOTS, "03-command-center.png") });
await page.keyboard.press("Escape");

// ── Edition switch ────────────────────────────────────────────────────────
await page.locator('button[aria-label="晚版"]').first().click();
await page.waitForTimeout(900);
const eveningText = await masthead.innerText();
const nightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("edition switch prints the evening paper", eveningText.includes("晚版") && eveningText.includes("晚"));
check("evening edition prints on dark stock", nightBg === "rgb(20, 20, 15)", nightBg);
await page.screenshot({ path: path.join(SHOTS, "04-today-evening.png"), fullPage: true });
await page.locator('button[aria-label="晨版"]').first().click();
await page.waitForTimeout(700);

// ── Every route, zh-CN, desktop ───────────────────────────────────────────
for (const route of ROUTES) {
  const slug = route.replace(/\//g, "_") || "_root";
  const errorsBefore = consoleErrors.length;
  await page.goto(`${BASE}/zh-CN${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  const h1 = await main.locator("h1").first().textContent().catch(() => "");
  check(`route ${route} renders a heading`, (h1 ?? "").trim().length > 0, (h1 ?? "").trim().slice(0, 24));
  await page.screenshot({ path: path.join(SHOTS, `zh${slug}.png`), fullPage: true });
  check(`route ${route} has no console errors`, consoleErrors.length === errorsBefore);
}

// ── Locale switch ─────────────────────────────────────────────────────────
await page.goto(`${BASE}/zh-CN/automation`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.locator('button[aria-label="切换语言"]').first().click();
await page.waitForTimeout(2600);
check("locale switch reaches /en/", page.url().includes("/en/"), page.url());
const enH1 = (await main.locator("h1").first().textContent().catch(() => "")) ?? "";
check("English heading rendered", /automation/i.test(enH1), enH1.trim());
const enMast = await masthead.innerText();
check("English dateline rendered", /Issue\s*\d+/i.test(enMast), enMast.split("\n").slice(1, 3).join(" "));
await page.screenshot({ path: path.join(SHOTS, "en-automation.png"), fullPage: true });

// ── Mobile ────────────────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 });
for (const route of ["/today", "/inbox", "/knowledge", "/automation"]) {
  await page.goto(`${BASE}/zh-CN${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`no horizontal overflow @390 on ${route}`, overflow <= 2, `overflow=${overflow}px`);
  await page.screenshot({ path: path.join(SHOTS, `mobile${route.replace(/\//g, "_")}.png`), fullPage: true });
}
const mobileNav = page.locator('nav[aria-label="菜单导航"]').first();
check("mobile bottom nav is visible", await mobileNav.isVisible());

// ── Global: no console errors anywhere ────────────────────────────────────
const realErrors = consoleErrors.filter(
  (e) => !/favicon|DevTools|download the React DevTools/i.test(e),
);
check("zero console errors across the whole walk", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

await browser.close();

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.extra ? `  (${c.extra})` : ""}`);
  if (c.ok) pass += 1;
}
console.log(`\n${pass}/${checks.length} checks passed`);
console.log(`screenshots → ${SHOTS}`);
process.exit(pass === checks.length ? 0 : 1);
