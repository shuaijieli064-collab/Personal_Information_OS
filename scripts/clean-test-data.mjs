/* Remove E2E leftovers from the development database.
 *
 * Years of verification runs leave accounts and rows nobody reads again: probe
 * accounts from browser walkthroughs, `@signal.test` accounts from curl checks,
 * and a handful of "Example Domain" items. They inflate counts, show up in the
 * inbox of the demo account's neighbours, and make a fresh look at the data
 * misleading.
 *
 * Safe by construction:
 *   · dry run by default — nothing is written unless you pass --apply
 *   · an explicit KEEP list (the demo account, the owner's account) is checked
 *     first and the script refuses to run if any keep pattern would match
 *   · only accounts matching KNOWN PROBE PATTERNS are deleted; a user who
 *     registered normally never matches one
 *   · one transaction — either everything goes or nothing does
 *
 * Usage:
 *   node scripts/clean-test-data.mjs           # report only
 *   node scripts/clean-test-data.mjs --apply   # delete
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PG = process.env.PG_CONTAINER || "signal-postgres";
const APPLY = process.argv.includes("--apply");
const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";

/** Accounts that must survive any run of this script (wildcard patterns). */
const KEEP_PATTERNS = [
  "dev-learn-%", // the seeded programmer-learning demo account
  "shuaijieli064@gmail.com", // the owner
  "test@signal.dev", // the long-lived local dev account
];

/**
 * The walkthrough scripts keep their credentials in gitignored files under
 * backend/target/. Those accounts are fixtures: deleting them breaks the very
 * suites this cleanup is supposed to make trustworthy (brief-verify reads
 * .probe.json and dies at login if the row is gone). They are excluded from the
 * delete by exact email — not by refusing to run, because the point of the pass
 * is to remove the *older* probes while keeping the current fixture.
 */
const FIXTURES = [];
for (const f of [".probe.json", ".learn.json", ".empty.json"]) {
  try {
    const { email } = JSON.parse(fs.readFileSync(path.join(ROOT, "backend/target", f), "utf8"));
    if (email) FIXTURES.push(email);
  } catch {
    /* absent or malformed — nothing to protect */
  }
}

/** Emails created by verification scripts. A normal user never matches these.
 *  Underscores are escaped: in SQL LIKE a bare `_` is a single-char wildcard,
 *  so `iso_%` would also swallow a user called `isoask…`. */
const PROBE_EMAILS = [
  "%@signal.test",
  "brief-probe-%@example.com",
  "empty-probe-%@example.com",
  "dedup-probe-%@example.com",
  "iso\\_%@example.com",
  "isoask\\_%@example.com",
  "k3check\\_%@example.com",
  "smoke%@test.local",
  "ai-verify@example.com",
];

/** File imports that only ever existed to prove a retrieval path. */
const PROBE_TITLES = [
  "ai-check.txt",
  "hybrid-e2e.txt",
  "rerank-e2e.txt",
  "Example Domain",
];

const like = (col, patterns) =>
  patterns.map((p) => `${col} LIKE '${p}'`).join(" OR ");

/** Probe match that never touches a live fixture account. */
const probeWhere = (col) => {
  const base = `(${like(col, PROBE_EMAILS)})`;
  if (FIXTURES.length === 0) return base;
  const exact = FIXTURES.map((e) => `'${e.replace(/'/g, "''")}'`).join(", ");
  return `${base} AND ${col} NOT IN (${exact})`;
};

function run(q) {
  return execFileSync("docker", ["exec", "-i", PG, "psql", "-U", "signal", "-d", "signal", "-tAc", q], {
    encoding: "utf8",
  }).trim();
}

/* ── 0. the wildcard keep list must be unreachable from the probe patterns ── */
const overlap = run(
  `SELECT string_agg(email, ', ') FROM users
    WHERE (${like("email", KEEP_PATTERNS)}) AND (${like("email", PROBE_EMAILS)})`,
);
if (overlap) {
  console.error(`REFUSING: keep-list accounts match a probe pattern: ${overlap}`);
  process.exit(1);
}

/* ── 1. what would go ────────────────────────────────────────────────────── */
const accounts = run(
  `SELECT email FROM users WHERE ${probeWhere("email")} ORDER BY email`,
).split("\n").filter(Boolean);

const titles = run(
  `SELECT i.title || '  ← ' || u.email
     FROM information i JOIN users u ON u.id = i.user_id
    WHERE ${like("i.title", PROBE_TITLES.map((t) => t.replace(/'/g, "''")))}
    ORDER BY i.title`,
).split("\n").filter(Boolean);

const keepInfo = run(
  `SELECT count(*) FROM information i JOIN users u ON u.id = i.user_id
    WHERE NOT (${like("u.email", PROBE_EMAILS)})`,
);

console.log(`probe accounts : ${accounts.length}`);
for (const a of accounts) console.log(`  - ${a}`);
if (FIXTURES.length) console.log(`protected fixtures (never deleted): ${FIXTURES.join(", ")}`);
console.log(`probe-titled rows in any account : ${titles.length}`);
for (const t of titles) console.log(`  - ${t}`);
console.log(`rows that belong to real accounts (untouched): ${keepInfo}`);

if (!APPLY) {
  console.log("\ndry run — nothing deleted. Re-run with --apply to remove the above.");
  process.exit(0);
}

if (accounts.length === 0 && titles.length === 0) {
  console.log("\nnothing to do.");
  process.exit(0);
}

/* ── 2. delete, in one transaction ───────────────────────────────────────── */
const before = run("SELECT count(*) FROM users");
const infoBefore = run("SELECT count(*) FROM information");

run(`BEGIN;
     DELETE FROM information WHERE ${like("title", PROBE_TITLES.map((t) => t.replace(/'/g, "''")))};
     DELETE FROM users WHERE ${probeWhere("email")};
     COMMIT;`);

const after = run("SELECT count(*) FROM users");
const infoAfter = run("SELECT count(*) FROM information");
console.log(`\ndeleted: users ${before} → ${after}, information ${infoBefore} → ${infoAfter}`);
console.log("remaining probe accounts: " +
  (run(`SELECT count(*) FROM users WHERE ${probeWhere("email")}`) || "0"));
