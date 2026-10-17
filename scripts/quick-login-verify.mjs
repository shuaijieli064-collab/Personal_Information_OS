import fs from "node:fs";
const ROOT = "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE);
const creds = JSON.parse(fs.readFileSync(`${ROOT}/backend/target/.learn.json`, "utf8"));
const url = `http://localhost:3000/login-now.html?email=${encodeURIComponent(creds.email)}&password=${encodeURIComponent(creds.password)}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));

await page.goto(url, { waitUntil: "domcontentloaded" });
try {
  await page.waitForURL((u) => u.pathname.includes("/today"), { timeout: 20000 });
} catch {
  const body = await page.locator("body").innerText().catch(() => "");
  console.log("FAIL did not redirect — page said:", body.slice(0, 200));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(3000);

const hasAccess = await page.evaluate(() => !!localStorage.getItem("signal.access"));
const hasRefresh = await page.evaluate(() => !!localStorage.getItem("signal.refresh"));
const text = await page.locator("main").last().innerText().catch(() => "");
const checks = [
  ["redirected to /today", page.url().includes("/today")],
  ["access token stored", hasAccess],
  ["refresh token stored", hasRefresh],
  ["seeded front page loaded", text.includes("今日要闻") && text.includes("Raft 精读")],
  ["zero console errors", errors.length === 0],
];
let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) ok = false;
}
if (errors.length) console.log("console errors:", errors.slice(0, 3));
await page.screenshot({ path: `${ROOT}/ui-design-runs/learn-shots/11-quick-login.png`, fullPage: true });
await browser.close();
console.log(ok ? "\nQUICK LOGIN OK" : "\nQUICK LOGIN FAILED");
process.exit(ok ? 0 : 1);
