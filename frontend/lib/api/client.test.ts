import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, tokens, onUnauthorized, ApiError } from "./client";

function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("token refresh lifecycle", () => {
  it("replays a 401 request once after refreshing the access token", async () => {
    tokens.set("expired", "refresh-token");
    fetchMock
      .mockResolvedValueOnce(res(401, null)) // first attempt rejected
      .mockResolvedValueOnce(res(200, {
        success: true,
        data: { accessToken: "fresh", refreshToken: "rotated" },
      }))
      .mockResolvedValueOnce(res(200, { success: true, data: { items: [] } }));

    const out = await api.get<{ items: unknown[] }>("/api/v1/information?page=0&size=20");

    expect(out.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokens.access).toBe("fresh");
    expect(tokens.refresh).toBe("rotated");
  });

  it("shares a single refresh across concurrent 401s (single-flight)", async () => {
    tokens.set("expired", "refresh-token");
    fetchMock
      .mockResolvedValueOnce(res(401, null)) // request A attempt
      .mockResolvedValueOnce(res(401, null)) // request B attempt
      .mockResolvedValueOnce(res(200, { success: true, data: { accessToken: "fresh" } })) // one refresh
      .mockResolvedValueOnce(res(200, { success: true, data: { items: [1] } }))
      .mockResolvedValueOnce(res(200, { success: true, data: { items: [2] } }));

    const [a, b] = await Promise.all([
      api.get<{ items: number[] }>("/a"),
      api.get<{ items: number[] }>("/b"),
    ]);

    expect(a.items).toEqual([1]);
    expect(b.items).toEqual([2]);

    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url).endsWith("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("clears tokens and broadcasts unauthorized when refresh fails", async () => {
    tokens.set("expired", "refresh-token");
    fetchMock
      .mockResolvedValueOnce(res(401, null))
      .mockResolvedValueOnce(res(401, {
        success: false,
        error: { code: "INVALID_REFRESH", message: "nope" },
      }));

    const listener = vi.fn();
    const off = onUnauthorized(listener);

    await expect(api.get("/api/v1/today")).rejects.toBeInstanceOf(ApiError);

    expect(tokens.access).toBeNull();
    expect(tokens.refresh).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("clears and broadcasts when a 401 arrives with no refresh token", async () => {
    tokens.set("expired");
    fetchMock.mockResolvedValueOnce(res(401, null));

    const listener = vi.fn();
    const off = onUnauthorized(listener);

    await expect(api.get("/api/v1/today")).rejects.toBeInstanceOf(ApiError);

    expect(tokens.access).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
