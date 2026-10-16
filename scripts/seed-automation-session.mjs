// Seeds a session + automation data for the Phase 8 browser verification.
//
// Registers a throwaway user, creates the three job types, runs one so the run history
// is non-empty, and generates a brief. Tokens go through files so no credential ever
// hits the command line.
//
// Usage: API=http://127.0.0.1:8099 node scripts/seed-automation-session.mjs
import fs from "node:fs";
import path from "node:path";

const API = process.env.API || "http://127.0.0.1:8099";
const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const OUT = path.join(ROOT, "backend/target");

async function call(method, p, { token, body } = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

const email = `automation-ui-${Date.now()}@example.com`;
const auth = await call("POST", "/api/v1/auth/register", {
  body: { email, password: "verify-pass-123", displayName: "Automation UI" },
});

for (const type of ["SOURCE_SYNC", "DAILY_BRIEF", "FEEDBACK_LOOP"]) {
  await call("POST", "/api/v1/automation/jobs", { token: auth.accessToken, body: { type } });
}

const jobs = await call("GET", "/api/v1/automation/jobs", { token: auth.accessToken });
// Run the sync job twice: one success, plus a failure we can force later — for now just
// make sure the history has a real terminal run to render.
await call("POST", `/api/v1/automation/jobs/${jobs.jobs.find((j) => j.type === "SOURCE_SYNC").id}/run`, {
  token: auth.accessToken,
});

// Pause the feedback job so the console shows a paused chip next to active ones.
await call("PATCH", `/api/v1/automation/jobs/${jobs.jobs.find((j) => j.type === "FEEDBACK_LOOP").id}`, {
  token: auth.accessToken,
  body: { enabled: false },
});

await call("POST", "/api/v1/brief/generate", { token: auth.accessToken });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, ".access"), auth.accessToken, "utf8");
fs.writeFileSync(path.join(OUT, ".refresh"), auth.refreshToken, "utf8");
console.log(`seeded ${email} · ${jobs.jobs.length} jobs · tokens → ${OUT}`);
