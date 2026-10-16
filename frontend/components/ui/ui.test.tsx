import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { Input } from "./Input";
import { CountUp } from "@/components/motion/CountUp";

describe("ui primitives", () => {
  it("Spinner exposes a status role for screen readers", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("EmptyState renders title, body and action", () => {
    render(
      <EmptyState title="empty" body="body" action={<button>go</button>} />,
    );
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "go" })).toBeInTheDocument();
  });

  it("EmptyState renders a default icon plate and honors a custom icon", () => {
    const { container, unmount } = render(<EmptyState title="empty" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    unmount();
    const custom = render(<EmptyState title="empty" icon={<span data-testid="custom" />} />);
    expect(custom.container.querySelector("svg")).toBeNull();
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });

  it("Skeleton renders a placeholder block with a loading sweep", () => {
    render(<Skeleton className="h-4 w-40" />);
    const block = document.querySelector(".skeleton-shimmer");
    expect(block).toBeInTheDocument();
    // Placeholders are decorative: never announced to assistive tech.
    expect(block?.getAttribute("aria-hidden")).toBe("true");
  });

  it("Button primary carries the glow shadow and the shared focus ring", () => {
    render(<Button>go</Button>);
    const btn = screen.getByRole("button", { name: "go" });
    expect(btn.className).toContain("bg-signal");
    expect(btn.className).toContain("shadow-[0_14px_38px");
    expect(btn.className).toContain("focus-ring");
  });

  it("Button sizes and iconOnly shape the hit area", () => {
    const { rerender } = render(<Button size="sm">go</Button>);
    expect(screen.getByRole("button", { name: "go" }).className).toContain("h-8");
    rerender(
      <Button size="lg" iconOnly aria-label="only">
        x
      </Button>,
    );
    const square = screen.getByRole("button", { name: "only" });
    expect(square.className).toContain("h-12");
    expect(square.className).toContain("aspect-square");
  });

  it("Button loading disables itself and exposes the spinner", () => {
    render(<Button loading>go</Button>);
    const btn = screen.getByRole("button", { name: "go" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("Input focus uses the accent glow recipe", () => {
    render(<Input placeholder="p" />);
    const input = screen.getByPlaceholderText("p");
    expect(input.className).toContain("focus:border-signal/70");
    expect(input.className).toContain("focus:shadow-[0_0_18px");
  });

  it("CountUp jumps to the final value under prefers-reduced-motion", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    const original = window.matchMedia;
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    render(<CountUp to={42} suffix="%" />);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(await screen.findByText("42%")).toBeInTheDocument();
    window.matchMedia = original;
  });
});
