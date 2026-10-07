import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthGuard } from "./AuthGuard";

const { replace, push } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    localStorage.clear();
    replace.mockClear();
    push.mockClear();
  });

  it("renders children when an access token exists", () => {
    localStorage.setItem("signal.access", "tok");
    render(<AuthGuard><p>protected</p></AuthGuard>);
    expect(screen.getByText("protected")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders nothing for anonymous visitors", async () => {
    render(<AuthGuard><p>protected</p></AuthGuard>);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
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
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
