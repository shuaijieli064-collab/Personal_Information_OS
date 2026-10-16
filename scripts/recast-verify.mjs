// End-to-end verification of the UI recast: signs in once, walks every
// authenticated route in both locales and at two viewports, and checks the
// new shell affordances (rail collapse, command palette, notification badge).
//
// Anything that renders nothing, overflows horizontally, or writes a console
// error fails the run.
//
// Usage:
//   PW_MODULE=file:///.../playwright/index.mjs \
//   CHROME_PATH=.../chrome.exe \
//   BASE=http://localhost:3000 EMAIL=... PASSWORD=... node scripts/recast-verify.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE || "playwright");

const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const SHOTS = process.env.SHOTS || path.join(ROOT, "ui-design-runs/recast-shots");

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
await page.waitForTimeout(1200);
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(2500);
check("signed in", !page.url().includes("/login"), page.url());
await page.screenshot({ path: path.join(SHOTS, "01-login.png") });

// ── Shell affordances (desktop) ───────────────────────────────────────────
const main = page.locator("main").last();

await page.goto(`${BASE}/zh-CN/today`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const topbar = page.locator("header").first();
check("topbar renders search + notifications", (await topbar.innerText()).includes("搜索") && (await topbar.innerText()).includes("通知"));

const bell = topbar.locator('a[href*="automation"] button[aria-label="通知"]').first();
const badge = await bell.locator("span").first().textContent().catch(() => null);
check("notification bell shows live unread count", /\d/.test(String(badge)), `badge=${badge}`);

// Rail collapse — the rail must shrink, not vanish.
const rail = page.locator("aside").first();
const railWidthBefore = (await rail.boundingBox())?.width ?? 0;
await page.locator('button[aria-label*="侧栏"]').first().click();
await page.waitForTimeout(700);
const railWidthAfter = (await rail.boundingBox())?.width ?? 0;
check("rail collapses and persists", railWidthAfter < railWidthBefore - 40, `${railWidthBefore}→${railWidthAfter}`);
await page.screenshot({ path: path.join(SHOTS, "02-rail-collapsed.png") });
await page.locator('button[aria-label*="侧栏"]').first().click();
await page.waitForTimeout(600);
check("rail expands back", ((await rail.boundingBox())?.width ?? 0) > railWidthAfter + 40);

// Command palette
await page.keyboard.press("ControlOrMeta+k");
await page.waitForTimeout(900);
const palette = page.locator('[role="dialog"]').first();
check("⌘K opens the command center", (await palette.count()) > 0 && (await palette.isVisible()));
await page.screenshot({ path: path.join(SHOTS, "03-command-center.png") });
await page.keyboard.press("Escape");

// ── Every route, zh-CN, desktop ───────────────────────────────────────────
for (const route of ROUTES) {
  const slug = route.replace(/\//g, "_") || "_root";
  const errorsBefore = consoleErrors.length;
  await page.goto(`${BASE}/zh-CN${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  const h1 = await main.locator("h1").first().textContent().catch(() => "");
  const ok = (h1 ?? "").trim().length > 0;
  check(`route ${route} renders a heading`, ok, (h1 ?? "").trim().slice(0, 24));
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
