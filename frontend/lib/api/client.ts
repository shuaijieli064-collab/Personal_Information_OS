/** Single API client — no fetch() calls scattered in components. */
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const ACCESS = "signal.access";
const REFRESH = "signal.refresh";

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

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  });

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
    api.post<{ fetched: number; created: number; duplicates: number }>(
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

export const informationApi = {
  page: (page = 0, size = 20) =>
    api.get<{ items: InformationItem[]; total: number }>(
      `/api/v1/information?page=${page}&size=${size}`),
  get: (id: string) => api.get<InformationItem>(`/api/v1/information/${id}`),
  understanding: (id: string) =>
    api.get<Understanding | null>(`/api/v1/information/${id}/understanding`),
};
