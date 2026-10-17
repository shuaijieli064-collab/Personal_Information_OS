/* Logs in with the probe account and dumps exactly what the masthead renders:
   the edition mark character, its computed class, and the dateline text.
   Used to settle whether the morning/evening edition prints correctly. */
import { mkdirSync, readFileSync } from "node:fs";

const { chromium } = await import(process.env.PW_MODULE);
const BASE = process.env.BASE || "http://localhost:3000";
const creds = JSON.parse(readFileSync("backend/target/.probe.json", "utf8"));
const OUT = "ui-design-runs/brief-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
await page.evaluate(() => {
  try {
    localStorage.removeItem("signal-theme");
  } catch {}
  document.cookie = "signal-theme=; path=/; max-age=0";
});
await page.fill('input[type="email"]', creds.email);
await page.fill('input[type="password"]', creds.password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/zh-CN/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const spans = [...document.querySelectorAll("header span")];
  const mark = spans.find((e) => /^[晨晚]$/.test((e.textContent || "").trim()));
  const dl = document.querySelector("header p.dateline");
  const cs = mark ? getComputedStyle(mark) : null;
  return {
    mark: mark ? mark.textContent.trim() : null,
    markBg: cs ? cs.backgroundColor : null,
    dateline: dl ? dl.textContent : null,
    theme: document.documentElement.getAttribute("data-theme"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
});
console.log("MASTHEAD " + JSON.stringify(info));

await page.locator("header").first().screenshot({ path: `${OUT}/_masthead-zoom.png` });
console.log("shot written");
await browser.close();
