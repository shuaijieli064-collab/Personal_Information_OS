// Opens the real login form in a real Chrome, signs in with the seeded account,
// lands on /automation and reports what rendered. Read-only walkthrough — it clicks
// nothing destructive, so the seeded data stays as-is for the user's own testing.
const { chromium } = await import(process.env.PW_MODULE || "playwright");

const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const SHOTS = process.env.SHOTS || "D:/A_Items/Personal_Information_OS/ui-design-runs/automation-shots";
const LOCALE = "zh-CN";

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const checks = [];
const check = (name, ok, extra = "") => checks.push({ name, ok, extra });

// 1. Login
await page.goto(`${BASE}/${LOCALE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const emailBox = page.locator('input[type="email"], input[name="email"]').first();
const passBox = page.locator('input[type="password"]').first();
check("login form visible", (await emailBox.count()) > 0 && (await passBox.count()) > 0);
await emailBox.fill(EMAIL);
await passBox.fill(PASSWORD);
await page.screenshot({ path: `${SHOTS}/live-login.png` });
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
check("signed in (left /login)", !page.url().includes("/login"), page.url());

// 2. Automation console
await page.goto(`${BASE}/${LOCALE}/automation`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const main = page.locator("main").last();
const h1 = (await main.locator("h1").first().textContent().catch(() => "")) || "";
check("automation h1 rendered", h1.trim().length > 0, h1.trim());
const body = await main.innerText();
check("three job types present", ["SOURCE_SYNC", "DAILY_BRIEF", "FEEDBACK_LOOP"].every((k) => body.includes(k)) || body.includes("同步") || body.includes("简报"));
check("notification inbox rendered", /通知|Notification/i.test(body));

// Run history lives behind each card's expander. The cards behave as an accordion
// (one open at a time), so open the last one — that is SOURCE_SYNC, the job the
// seeder actually ran, so it is the card that has a terminal run to render.
const expanders = main.locator("button[aria-expanded]");
const expanderCount = await expanders.count();
await expanders.nth(expanderCount - 1).click();
await page.waitForTimeout(1800);
const expanded = await main.innerText();
check("run history rendered", /SUCCEEDED|成功/i.test(expanded));
check("run detail rendered", /第\s*1\s*次|attempt\s*1|耗时|duration/i.test(expanded));
await page.screenshot({ path: `${SHOTS}/live-automation.png`, fullPage: true });

// 3. Narrow viewport sanity
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("no horizontal overflow @390", overflow <= 2, `overflow=${overflow}px`);
await page.screenshot({ path: `${SHOTS}/live-automation-mobile.png`, fullPage: true });

check("zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.extra ? `  (${c.extra})` : ""}`);
  if (c.ok) pass += 1;
}
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);
