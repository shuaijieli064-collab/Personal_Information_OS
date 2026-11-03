import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { authErrorMessage } from "./authError";

const t = (key: string) => `T:${key}`;

describe("authErrorMessage", () => {
  it("turns a 429 into a localized 'slow down' instruction", () => {
    const err = new ApiError(429, "RATE_LIMITED", "Too many requests. Try again in 42s.");
    expect(authErrorMessage(err, t)).toBe("T:errRateLimited");
  });

  it("keeps the server wording for other API failures", () => {
    const err = new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    expect(authErrorMessage(err, t)).toBe("Email or password is incorrect");
  });

  it("falls back for non-API failures", () => {
    expect(authErrorMessage(new Error("boom"), t)).toBe("T:fallbackError");
  });
});
