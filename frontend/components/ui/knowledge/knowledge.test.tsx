import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { KnowledgeCitation, ScoredChunk } from "@/lib/api/client";

// The catalogue is exercised by the app itself; here we only care that the
// components wire the right keys/values into the DOM, so echo them back.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { AnswerCard, citationAnchor } from "./AnswerCard";
import { CitationList } from "./CitationList";
import { KnowledgeResultCard } from "./KnowledgeResultCard";

const chunk = (over: Partial<ScoredChunk> = {}): ScoredChunk => ({
  chunkId: "c1",
  informationId: "info-1",
  ordinal: 2,
  content: "The nightly backup starts at 02:30 UTC.",
  score: 0.03279,
  vectorScore: null,
  keywordScore: null,
  title: "Runbook",
  url: null,
  type: "FILE",
  model: "embed",
  ...over,
});

const citation = (index: number, over: Partial<KnowledgeCitation> = {}): KnowledgeCitation => ({
  index,
  chunkId: `c${index}`,
  informationId: `info-${index}`,
  title: `Source ${index}`,
  url: null,
  type: "FILE",
  score: 0.9,
  ...over,
});

describe("KnowledgeResultCard", () => {
  it("shows rank, score, chunk metadata and a link into the inbox", () => {
    const { container } = render(<KnowledgeResultCard chunk={chunk()} rank={1} barWidth={80} />);

    expect(screen.getByText("Runbook")).toBeInTheDocument();
    expect(screen.getByText("0.0328")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // rank badge
    expect(screen.getByText("FILE")).toBeInTheDocument();
    expect(container.querySelector('a[href="/inbox/info-1"]')).toBeInTheDocument();
    expect(container.querySelector('[style*="width: 80%"]')).toBeInTheDocument();
  });

  it("renders one provenance chip per leg that returned the chunk", () => {
    render(<KnowledgeResultCard chunk={chunk({ vectorScore: 0.649, keywordScore: 2 })} rank={1} />);
    expect(screen.getByText(/legVector/)).toBeInTheDocument();
    expect(screen.getByText(/legKeyword/)).toBeInTheDocument();
    expect(screen.getByText(/0\.6490/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0000/)).toBeInTheDocument();
  });

  it("omits the vector chip when only the keyword leg matched", () => {
    render(<KnowledgeResultCard chunk={chunk({ keywordScore: 1.4 })} rank={2} />);
    expect(screen.queryByText(/legVector/)).toBeNull();
    expect(screen.getByText(/legKeyword/)).toBeInTheDocument();
  });

  it("falls back to a placeholder title and hides the original link when url is absent", () => {
    const { container } = render(<KnowledgeResultCard chunk={chunk({ title: "" })} rank={1} />);
    expect(screen.getByText("untitled")).toBeInTheDocument();
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
  });
});

describe("AnswerCard", () => {
  it("renders [n] markers as chips anchored to the citation list", () => {
    const { container } = render(
      <AnswerCard answer="Backup starts at 02:30 UTC [1], on-call is paged [2]." citations={[citation(1), citation(2)]} />,
    );

    expect(screen.getByText(/Backup starts at 02:30 UTC/)).toBeInTheDocument();
    expect(screen.getByText(/on-call is paged/)).toBeInTheDocument();
    expect(container.querySelector('a[href="#knowledge-cite-1"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="#knowledge-cite-2"]')).toBeInTheDocument();
  });

  it("still shows an unresolved marker rather than silently dropping it", () => {
    const { container } = render(<AnswerCard answer="Unverifiable claim [7]." citations={[citation(1)]} />);
    expect(container.querySelector('a[href="#knowledge-cite-7"]')).toBeNull();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders a marker-only answer", () => {
    render(<AnswerCard answer="[1]" citations={[citation(1)]} />);
    expect(screen.getByText("answerLabel")).toBeInTheDocument();
  });
});

describe("CitationList", () => {
  it("anchors each entry by index and links to the source", () => {
    const { container } = render(<CitationList citations={[citation(1), citation(2)]} />);

    expect(container.querySelector("#knowledge-cite-1")).toBeInTheDocument();
    expect(container.querySelector("#knowledge-cite-2")).toBeInTheDocument();
    expect(screen.getByText("Source 1")).toBeInTheDocument();
    expect(container.querySelector('a[href="/inbox/info-2"]')).toBeInTheDocument();
    expect(screen.getAllByText("0.9000")).toHaveLength(2);
  });

  it("shows an external link only when the citation has a url", () => {
    const { container } = render(
      <CitationList citations={[citation(1, { url: "https://example.com/a" }), citation(2)]} />,
    );
    expect(container.querySelector('a[href="https://example.com/a"]')).toBeInTheDocument();
    expect(container.querySelectorAll('a[target="_blank"]')).toHaveLength(1);
  });
});

describe("citationAnchor", () => {
  it("matches the id the citation list renders", () => {
    expect(citationAnchor(3)).toBe("knowledge-cite-3");
  });
});
