import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

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

  it("Skeleton renders a placeholder block", () => {
    render(<Skeleton className="h-4 w-40" />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
