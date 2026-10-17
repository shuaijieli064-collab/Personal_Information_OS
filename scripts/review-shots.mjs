import fs from "node:fs";
import path from "node:path";
const ROOT = "D:/A_Items/Personal_Information_OS";
const OUT = path.join(ROOT, "ui-design-runs", "review-shots");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PW_MODULE);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 120)); });

await page.goto("http://localhost:3000/login-now.html", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const shots = [
  ["today", "/zh-CN/today"],
  ["inbox", "/zh-CN/inbox"],
  ["knowledge", "/zh-CN/knowledge"],
  ["ai", "/zh-CN/ai"],
  ["automation", "/zh-CN/automation"],
  ["discover", "/zh-CN/discover"],
];

for (const [name, url] of shots) {
  await page.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
  const h1 = await page.locator("h1").first().innerText().catch(() => "?");
  const txt = await page.locator("body").innerText();
  console.log(`${name.padEnd(11)} h1="${h1.replace(/\n/g, " ")}" chars=${txt.length}`);
}

console.log("errors:", errors.length ? errors.slice(0, 6).join(" | ") : "none");
await browser.close();
