// Dumps the shape (keys only, plus small scalar values) of the automation console
// payloads so we can confirm the frontend will render real data.
const API = process.env.API || "http://127.0.0.1:8099";

function shape(v, depth = 0) {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.length}] ${v.length ? shape(v[0], depth + 1) : ""}`.trim();
  if (typeof v === "object") {
    return `{ ${Object.keys(v).join(", ")} }`;
  }
  return typeof v;
}

async function call(method, p, { token, body } = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data };
}

const login = await call("POST", "/api/v1/auth/login", {
  body: { email: process.env.EMAIL, password: process.env.PASSWORD },
});
const t = login.data.accessToken;

const jobs = await call("GET", "/api/v1/automation/jobs", { token: t });
console.log("jobs.data  =", shape(jobs.data));
console.log("jobs[0]    =", shape(jobs.data.jobs[0]));
console.log("types      =", jobs.data.jobs.map((j) => `${j.type}:${j.enabled ? "on" : "off"}`).join(", "));

const sync = jobs.data.jobs.find((j) => j.type === "SOURCE_SYNC");
const runs = await call("GET", `/api/v1/automation/jobs/${sync.id}/runs?page=0&size=20`, { token: t });
console.log("runs.data  =", shape(runs.data), "total =", runs.data.total);
if (runs.data.items?.length) console.log("run[0]     =", shape(runs.data.items[0]));

const notif = await call("GET", "/api/v1/notifications?unread=false&page=0&size=20", { token: t });
console.log("notif.data =", shape(notif.data), "total =", notif.data.total, "unread =", notif.data.unreadCount);
if (notif.data.items?.length) console.log("notif[0]   =", shape(notif.data.items[0]));

const brief = await call("GET", "/api/v1/brief/latest", { token: t });
console.log("brief.data =", shape(brief.data));
