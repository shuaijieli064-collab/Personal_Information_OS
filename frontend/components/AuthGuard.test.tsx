import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { AuthGuard } from "./AuthGuard";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe("AuthGuard", () => {
  beforeEach(() => localStorage.clear());

  it("renders children when an access token exists", () => {
    localStorage.setItem("signal.access", "tok");
    render(<AuthGuard><p>protected</p></AuthGuard>);
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("renders nothing for anonymous visitors", () => {
    render(<AuthGuard><p>protected</p></AuthGuard>);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("hides content when the API client broadcasts unauthorized", async () => {
    localStorage.setItem("signal.access", "tok");
    render(<AuthGuard><p>protected</p></AuthGuard>);
    expect(screen.getByText("protected")).toBeInTheDocument();

    localStorage.removeItem("signal.access");
    await act(async () => {
      window.dispatchEvent(new Event("signal:unauthorized"));
    });

    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });
});
