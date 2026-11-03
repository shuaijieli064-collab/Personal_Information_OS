import { ApiError } from "./client";

/**
 * Message shown on the auth screens.
 *
 * The server's own sentence is a good fallback, but a throttled user needs an
 * instruction ("wait"), not a protocol detail they cannot see. Everything else keeps
 * the server wording so a wrong password and an unknown email stay distinguishable.
 */
export function authErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === "RATE_LIMITED") return t("errRateLimited");
  return error instanceof ApiError ? error.message : t("fallbackError");
}
