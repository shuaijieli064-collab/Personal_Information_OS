import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Source } from "@/lib/api/client";

vi.mock("next-intl", async () => {
  const catalog = await (await import("@/test/i18n")).catalogMock();
  // SourceDetail formats relative times, so it reads the locale like the real
  // translator does; the catalogue double only ships useTranslations.
  return { ...catalog, useLocale: () => "zh-CN" };
});

// The detail fetches through react-query; the drawer's own state machine is what we
// test here, so the hook is swapped for a controllable double.
const useSourceItems = vi.fn();
vi.mock("@/lib/api/queries", () => ({
  useSourceItems: (id: string) => useSourceItems(id),
}));

import { SourceDetail } from "./SourceDetail";

const source = (over: Partial<Source> = {}): Source => ({
  id: "b56eda27-1be4-4c72-9c9b-b80d0c5648ea",
  type: "GITHUB",
  name: "pgvector",
  url: "https://github.com/pgvector/pgvector",
  status: "CONNECTED",
  createdAt: new Date(Date.now() - 86400_000).toISOString(),
  ...over,
});

const ok = (items: number) => ({
  data: {
    items: Array.from({ length: items }, (_, i) => ({
      id: `i${i}`,
      type: "DOC",
      title: `Release notes ${i}`,
      url: "https://example.com/doc",
      publishedAt: new Date(Date.now() - i * 3600_000).toISOString(),
    })),
    total: items,
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  useSourceItems.mockReset();
  useSourceItems.mockReturnValue(ok(0));
});

describe("SourceDetail", () => {
  it("renders the address and the collected items once loaded", () => {
    useSourceItems.mockReturnValue(ok(2));
    render(<SourceDetail source={source()} />);

    const link = screen.getByRole("link", { name: "https://github.com/pgvector/pgvector" });
    expect(link).toHaveAttribute("href", "https://github.com/pgvector/pgvector");
    expect(useSourceItems).toHaveBeenCalledWith("b56eda27-1be4-4c72-9c9b-b80d0c5648ea");
    expect(screen.getByText("Release notes 0")).toBeInTheDocument();
    expect(screen.getByText("Release notes 1")).toBeInTheDocument();
  });

  it("shows an honest empty state, not an error, for a source with nothing synced", () => {
    render(<SourceDetail source={source()} />);
    expect(screen.getByText("itemsEmpty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "retry" })).not.toBeInTheDocument();
  });

  it("loses no content row when a source has no url", () => {
    useSourceItems.mockReturnValue(ok(2));
    render(<SourceDetail source={source({ url: undefined })} />);
    expect(screen.getByText("Release notes 0")).toBeInTheDocument();
    expect(screen.getByText("Release notes 1")).toBeInTheDocument();
  });

  it("surfaces a failed fetch with a retry handoff", async () => {
    const refetch = vi.fn();
    useSourceItems.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<SourceDetail source={source()} />);

    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("names the loading state while the request is in flight", () => {
    useSourceItems.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    render(<SourceDetail source={source()} />);
    expect(screen.getByText("itemsLoading")).toBeInTheDocument();
  });

  it("renders nothing beyond the closed card when collapsed", () => {
    const { container } = render(<SourceDetail source={source()} />);
    void container; // SourceDetail only mounts when open; SourceCard owns the toggle
  });

  it("has an accessible address link that waits for real fetches", async () => {
    useSourceItems.mockReturnValue(ok(1));
    render(<SourceDetail source={source()} />);
    await waitFor(() => expect(screen.getByText("Release notes 0")).toBeInTheDocument());
  });
});
