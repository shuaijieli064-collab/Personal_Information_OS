import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { SourceSuggestion } from "@/lib/api/client";

vi.mock("next-intl", async () => (await import("@/test/i18n")).catalogMock());

// framer-motion's whileInView needs IntersectionObserver, which jsdom does not
// provide — the stagger orchestration is decoration; the panel state machine is
// what fails users. Stand-ins keep the card list in the plain document flow.
vi.mock("@/components/motion/Stagger", () => ({
  Stagger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { SuggestionCard, SuggestionList } from "./SuggestionList";

const suggestion = (over: Partial<SourceSuggestion> = {}): SourceSuggestion => ({
  title: "pgvector Releases",
  url: "https://github.com/pgvector/pgvector",
  type: "GITHUB",
  reason: "你在补数据库知识，这个仓库的 Release 直接相关。",
  ...over,
});

const baseProps = {
  isLoading: false,
  isError: false,
  addedUrls: new Set<string>(),
  addingUrl: null as string | null,
  onAdd: vi.fn(),
  onRetry: vi.fn(),
};

describe("SuggestionList states", () => {
  it("shows loading skeletons while toned down, before any result", () => {
    render(<SuggestionList {...baseProps} isLoading />);
    expect(screen.getByTestId("suggestions-loading")).toBeInTheDocument();
  });

  it("renders nothing for no-run idle state", () => {
    const { container } = render(<SuggestionList {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("surfaces a request failure with a retry handoff", () => {
    const onRetry = vi.fn();
    render(<SuggestionList {...baseProps} isError onRetry={onRetry} />);

    expect(screen.getByTestId("suggestions-error")).toBeInTheDocument();
    expect(screen.getByText("suggestFailed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("tells an honest empty apart from an engine degradation", () => {
    // honest empty: the model answered, nothing verified — plain guidance
    const { unmount } = render(
      <SuggestionList {...baseProps} suggestions={[]} fallback={null} />,
    );
    expect(screen.getByTestId("suggestions-empty")).toBeInTheDocument();
    expect(screen.getByText("noVerifiedHint")).toBeInTheDocument();
    expect(screen.queryByTestId("suggestions-fallback")).not.toBeInTheDocument();
    unmount();

    // degraded: the engine never answered — the panel names it as such, never
    // letting an empty list read as "nothing exists to follow"
    render(<SuggestionList {...baseProps} suggestions={[]} fallback="manual" />);
    expect(screen.getByTestId("suggestions-fallback")).toBeInTheDocument();
    expect(screen.getByText("fallbackTitle")).toBeInTheDocument();
    expect(screen.getByText("fallbackBody")).toBeInTheDocument();
  });
});

describe("SuggestionList results", () => {
  it("renders every verified card with its trust statement and one add action", () => {
    const onAdd = vi.fn();
    const items = [
      suggestion(),
      suggestion({ title: "Postgres Weekly", url: "https://postgresweekly.com/rss",
        type: "RSS", reason: "每周一份精选。" }),
    ];
    render(<SuggestionList {...baseProps} suggestions={items} onAdd={onAdd} />);

    expect(screen.getByText("pgvector Releases")).toBeInTheDocument();
    // the URL travelled too — it is what the verification actually happened on
    expect(screen.getByTitle("https://github.com/pgvector/pgvector")).toBeInTheDocument();

    // the two different kinds get different chips, both real enum names
    expect(screen.getByText("GITHUB")).toBeInTheDocument();
    expect(screen.getByText("RSS")).toBeInTheDocument();
    expect(screen.getAllByText("verified")).toHaveLength(2);
    expect(screen.getAllByText("whyRecommended")).toHaveLength(2);
    expect(screen.getByText("每周一份精选。")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "add" })[0]);
    expect(onAdd).toHaveBeenCalledWith(items[0]);
  });

  it("swaps the button for an added marker once the source is in", () => {
    render(
      <SuggestionList
        {...baseProps}
        suggestions={[suggestion()]}
        addedUrls={new Set(["https://github.com/pgvector/pgvector"])}
      />,
    );
    expect(screen.getByText("added")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "add" })).not.toBeInTheDocument();
  });
});

describe("SuggestionCard", () => {
  it("passes the whole item, not just its fields, back to the adder", () => {
    const onAdd = vi.fn();
    const item = suggestion();
    render(<SuggestionCard item={item} added={false} adding={false} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(onAdd).toHaveBeenCalledWith(item);
  });
});
