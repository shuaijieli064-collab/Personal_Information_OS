/**
 * Single API client — no fetch() calls scattered in components.
 *
 * Auth lifecycle:
 *  - access token in localStorage (`signal.access`), refresh in `signal.refresh`
 *  - a 401 triggers one in-flight refresh (single-flight, concurrent callers share it);
 *    success replays the original request once with the new access token
 *  - refresh failure clears tokens and emits `signal:unauthorized` so guards can
 *    redirect to /login
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const ACCESS = "signal.access";
const REFRESH = "signal.refresh";
const UNAUTHORIZED_EVENT = "signal:unauthorized";

export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

function emitUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

/** Subscribe to session-loss broadcasts; returns an unsubscribe fn. */
export function onUnauthorized(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UNAUTHORIZED_EVENT, fn);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, fn);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokens.refresh;
  if (!refresh) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success || !body?.data?.accessToken) return null;
        const next = body.data.refreshToken ?? refresh;
        tokens.set(body.data.accessToken, next);
        return body.data.accessToken as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token?: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

  let res = await doFetch(tokens.access ?? undefined);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      res = await doFetch(fresh);
      if (res.status === 401) {
        // The freshly-minted token was rejected too (revoked/rotated elsewhere):
        // the session is unrecoverable — clear it and let guards redirect,
        // instead of leaving a zombie session behind.
        tokens.clear();
        emitUnauthorized();
      }
    } else {
      // Session is unrecoverable (no refresh token, or refresh itself rejected).
      tokens.clear();
      emitUnauthorized();
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    // statusText is empty over HTTP/2, so never let the message fall back to "".
    throw new ApiError(
      res.status,
      body?.error?.code ?? "ERROR",
      body?.error?.message || res.statusText || `Request failed (${res.status})`,
    );
  }
  return body.data as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};

export type Source = {
  id: string; type: string; name: string; url?: string;
  status: string; lastSyncedAt?: string; createdAt: string;
};
/** Inbox triage states. ACTIVE = waiting, KEPT = kept on purpose, ARCHIVED = dismissed. */
export type TriageStatus = "ACTIVE" | "KEPT" | "ARCHIVED";

export type InformationItem = {
  id: string; type: string; title: string; excerpt?: string;
  content?: string; url?: string; author?: string; publishedAt?: string;
  status?: TriageStatus;
  /** Null for direct imports that never came from a connected source. */
  sourceId?: string;
};

export const sourcesApi = {
  list: () => api.get<Source[]>("/api/v1/sources"),
  create: (body: { name: string; type: string; url?: string }) =>
    api.post<Source>("/api/v1/sources", body),
  remove: (id: string) => api.del(`/api/v1/sources/${id}`),
  sync: (id: string) =>
    api.post<{ fetched: number; created: number; updated: number; duplicates: number; failed: number }>(
      `/api/v1/sources/${id}/sync`),
};

/** One live-verified source suggestion from the discover pipeline. */
export type SourceSuggestion = {
  title: string; url: string; type: string; reason: string;
};

export type DiscoverSuggest = {
  /** Verified candidates only; empty + fallback="manual" means the engine degraded. */
  suggestions: SourceSuggestion[];
  /** null on the happy path; the UI shows an honest placeholder when it names one. */
  fallback: string | null;
};

export const discoverApi = {
  suggest: (body: { query: string; limit?: number }) =>
    api.post<DiscoverSuggest>("/api/v1/discover/suggest", body),
};

export type Understanding = {
  classification?: string; confidence?: number; status?: string;
  summary?: string; keyPoints?: string[]; topics?: string[];
  signalScore?: number; relevanceScore?: number;
};

export type SignalItem = {
  id: string; title: string; summary?: string; signalScore?: number;
  whyItMatters?: string; status?: string;
};

export const todayApi = {
  get: () => api.get<{
    informationCount: number; signalCount: number;
    actionRequired: number; signals: SignalItem[];
  }>("/api/v1/today"),
};

export const signalsApi = {
  save: (id: string) => api.post<SignalItem>(`/api/v1/signals/${id}/save`),
  important: (id: string) => api.post<SignalItem>(`/api/v1/signals/${id}/important`),
  ignore: (id: string) => api.post<SignalItem>(`/api/v1/signals/${id}/ignore`),
  patchStatus: (id: string, status: string) =>
    api.patch<SignalItem>(`/api/v1/signals/${id}`, { status }),
};

/* The personalisation graph. Discover reads it for its "based on your goals"
   line so the chips come from the account instead of a hardcoded list. */
export type Profile = {
  bio?: string; displayName?: string; language?: string;
  timezone?: string; theme?: string; avatarUrl?: string;
  onboardingCompleted?: boolean;
};
export type Goal = {
  id: string; title: string; status: string; priority: number; description?: string;
};
export type Interest = {
  id: string; name: string; weight: number; source: string;
};
export type Skill = {
  id: string; name: string; level: string;
};

export const profileApi = {
  get: () => api.get<Profile>("/api/v1/profile"),
  goals: () => api.get<Goal[]>("/api/v1/goals"),
  interests: () => api.get<Interest[]>("/api/v1/interests"),
  skills: () => api.get<Skill[]>("/api/v1/skills"),
};

export const informationApi = {
  page: (page = 0, size = 20, status?: TriageStatus | `${TriageStatus},${TriageStatus}`) =>
    api.get<{
      items: InformationItem[];
      total: number;
      /** information id → signal id, for the rows on this page. */
      signalIds?: Record<string, string>;
      /** information id → the score the pipeline computed, so a kept row can say
       *  "45.8, threshold 70" instead of leaving the user to guess why it is not a signal. */
      signalScores?: Record<string, number>;
      /** The bar a score must clear to become a signal (app.signal.min-score). */
      signalMinScore?: number;
      /** source id → source name, so a row can name where it came from. */
      sourceNames?: Record<string, string>;
    }>(
      `/api/v1/information?page=${page}&size=${size}${status ? `&status=${status}` : ""}`),
  get: (id: string) => api.get<InformationItem>(`/api/v1/information/${id}`),
  understanding: (id: string) =>
    api.get<Understanding | null>(`/api/v1/information/${id}/understanding`),
  /** Persists a triage decision — this is what makes "ignore" survive a refresh. */
  setStatus: (id: string, status: TriageStatus) =>
    api.patch<InformationItem>(`/api/v1/information/${id}`, { status }),
  /** Runs the real pipeline (understand → score → maybe signal). May legitimately produce none. */
  analyse: (id: string) =>
    api.post<Understanding>(`/api/v1/information/${id}/understanding`),
};

/* ── Phase 6 Knowledge (K3 search / K4 RAG) ───────────────────────────────── */

export type KnowledgeMode = "HYBRID" | "VECTOR" | "KEYWORD";
export type AskStatus = "ANSWERED" | "NO_SOURCES" | "NO_ANSWER";

/** One retrieval hit: a chunk plus its owning Information's citation metadata. */
export type ScoredChunk = {
  chunkId: string;
  informationId: string;
  ordinal: number;
  content: string;
  /** Ranking score. RRF fusion score in HYBRID, the leg's own score in a single-leg mode. */
  score: number;
  /** Cosine similarity [0,1], or null when the vector leg did not return this chunk. */
  vectorScore: number | null;
  /** PostgreSQL ts_rank_cd, or null when the keyword leg did not return this chunk. */
  keywordScore: number | null;
  title: string;
  url?: string | null;
  type: string;
  model: string;
};

export type KnowledgeSearchResult = {
  query: string;
  mode: KnowledgeMode;
  model: string;
  limit: number;
  minScore: number;
  count: number;
  /** True only when the cross-encoder actually ran. */
  reranked: boolean;
  rerankModel: string | null;
  results: ScoredChunk[];
};

export type KnowledgeCitation = {
  index: number;
  chunkId: string;
  informationId: string;
  title: string;
  url?: string | null;
  type: string;
  score: number;
};

export type KnowledgeAskResult = {
  question: string;
  status: AskStatus;
  answer: string | null;
  model: string;
  embeddingModel: string;
  /** Chunks the retrieval legs returned. */
  retrievedCount: number;
  /** Sources that actually reached the model's context (≤ retrievedCount). */
  sourceCount: number;
  reranked: boolean;
  rerankModel: string | null;
  citations: KnowledgeCitation[];
};

export type KnowledgeReindexResult = {
  scanned: number;
  chunked: number;
  chunks: number;
  failed: number;
};

/** What the console's first screen reports before anyone searches. */
export type KnowledgeStats = {
  documents: number;
  chunks: number;
  embedded: number;
  lastIndexedAt: string | null;
};

export type KnowledgeSearchParams = {
  query: string;
  mode?: KnowledgeMode;
  limit?: number;
  minScore?: number;
  rerank?: boolean;
};

export type KnowledgeAskParams = {
  question: string;
  limit?: number;
  minScore?: number;
  rerank?: boolean;
};

export const knowledgeApi = {
  stats: () => api.get<KnowledgeStats>("/api/v1/knowledge/stats"),
  search: (body: KnowledgeSearchParams) =>
    api.post<KnowledgeSearchResult>("/api/v1/knowledge/search", body),
  ask: (body: KnowledgeAskParams) =>
    api.post<KnowledgeAskResult>("/api/v1/knowledge/ask", body),
  reindex: () =>
    api.post<KnowledgeReindexResult>("/api/v1/knowledge/reindex"),
};

// ── Phase 7 · Agent & tools ──────────────────────────────────────────────────

/** READ runs unattended; WRITE and DESTRUCTIVE stop the run for a human decision. */
export type ToolPermission = "READ" | "WRITE" | "DESTRUCTIVE";

export type AgentRunStatus =
  | "PLANNING"
  | "RUNNING"
  | "AWAITING_CONFIRMATION"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED";

export type AgentStepStatus =
  | "PLANNED"
  | "PENDING_CONFIRMATION"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED"
  | "REJECTED";

export type AgentTool = {
  name: string;
  description: string;
  permission: ToolPermission;
  parameters: Record<string, string>;
  required: string[];
};

export type AgentStep = {
  id: string;
  seq: number;
  tool: string | null;
  permission: ToolPermission | null;
  status: AgentStepStatus;
  arguments: Record<string, unknown> | null;
  result: unknown;
  rationale: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type AgentRun = {
  id: string;
  goal: string;
  status: AgentRunStatus;
  answer: string | null;
  model: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AgentStep[];
};

export type AgentRunPage = { items: AgentRun[]; total: number };

export const agentApi = {
  tools: () => api.get<{ tools: AgentTool[] }>("/api/v1/agent/tools"),
  create: (body: { goal: string; maxSteps?: number }) =>
    api.post<AgentRun>("/api/v1/agent/runs", body),
  list: (page = 0, size = 10) =>
    api.get<AgentRunPage>(`/api/v1/agent/runs?page=${page}&size=${size}`),
  get: (id: string) => api.get<AgentRun>(`/api/v1/agent/runs/${id}`),
  confirm: (id: string, body: { stepId?: string; note?: string } = {}) =>
    api.post<AgentRun>(`/api/v1/agent/runs/${id}/confirm`, body),
  reject: (id: string, body: { reason?: string } = {}) =>
    api.post<AgentRun>(`/api/v1/agent/runs/${id}/reject`, body),
};

// ── Phase 8 · Automation, brief & notifications ──────────────────────────────

/** The three recurring job kinds the scheduler knows how to run. */
export type JobType = "SOURCE_SYNC" | "DAILY_BRIEF" | "FEEDBACK_LOOP";

/** A run's lifecycle. DEAD is the dead-letter state: capped out and disabled. */
export type JobRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD";

export type Job = {
  id: string;
  type: JobType;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
};

export type JobRun = {
  id: string;
  jobId: string;
  status: JobRunStatus;
  attempt: number;
  detail: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type JobRunPage = { items: JobRun[]; total: number };

export type NotificationType = "DAILY_BRIEF" | "IMPORTANT_SIGNAL" | "JOB_FAILED";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  /** Raw JSON string; shape depends on `type`. */
  payload: string | null;
  createdAt: string;
};

export type NotificationPage = { items: Notification[]; total: number; unreadCount: number };

export const automationApi = {
  jobs: () => api.get<{ jobs: Job[] }>("/api/v1/automation/jobs"),
  /** Upsert on (user, type): creating an existing type rewrites it instead of duplicating. */
  upsertJob: (body: { type: JobType; intervalMinutes?: number; enabled?: boolean }) =>
    api.post<Job>("/api/v1/automation/jobs", body),
  patchJob: (id: string, body: { intervalMinutes?: number; enabled?: boolean }) =>
    api.patch<Job>(`/api/v1/automation/jobs/${id}`, body),
  deleteJob: (id: string) => api.del<void>(`/api/v1/automation/jobs/${id}`),
  runJob: (id: string) => api.post<JobRun>(`/api/v1/automation/jobs/${id}/run`),
  runs: (id: string, page = 0, size = 20) =>
    api.get<JobRunPage>(`/api/v1/automation/jobs/${id}/runs?page=${page}&size=${size}`),
  /** Re-enables a dead job, clears its failure count and runs it again. */
  retryRun: (id: string) => api.post<JobRun>(`/api/v1/automation/runs/${id}/retry`),
};

export const briefApi = {
  /** `brief` is null when none has been generated yet — an empty brief is not an error. */
  latest: () => api.get<{ brief: Notification | null }>("/api/v1/brief/latest"),
  generate: () => api.post<{ brief: Notification }>("/api/v1/brief/generate"),
};

export const notificationApi = {
  list: (unread = false, page = 0, size = 20) =>
    api.get<NotificationPage>(
      `/api/v1/notifications?unread=${unread}&page=${page}&size=${size}`,
    ),
  read: (id: string) => api.post<Notification>(`/api/v1/notifications/${id}/read`),
  readAll: () => api.post<{ updated: number }>("/api/v1/notifications/read-all"),
};
