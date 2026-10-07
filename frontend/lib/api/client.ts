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
export type InformationItem = {
  id: string; type: string; title: string; excerpt?: string;
  content?: string; url?: string; author?: string; publishedAt?: string;
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

export const informationApi = {
  page: (page = 0, size = 20) =>
    api.get<{ items: InformationItem[]; total: number }>(
      `/api/v1/information?page=${page}&size=${size}`),
  get: (id: string) => api.get<InformationItem>(`/api/v1/information/${id}`),
  understanding: (id: string) =>
    api.get<Understanding | null>(`/api/v1/information/${id}/understanding`),
};
