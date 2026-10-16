import { describe, expect, it } from "vitest";
import type { KnowledgeCitation, ScoredChunk } from "@/lib/api/client";
import {
  citedIndices,
  citationFor,
  formatScore,
  parseAnswerSegments,
  provenanceOf,
  relativeBarWidth,
  scoreRange,
} from "./format";

const chunk = (over: Partial<ScoredChunk> = {}): ScoredChunk => ({
  chunkId: "c1",
  informationId: "i1",
  ordinal: 0,
  content: "body",
  score: 0.5,
  vectorScore: null,
  keywordScore: null,
  title: "T",
  url: null,
  type: "ARTICLE",
  model: "m",
  ...over,
});

const citation = (index: number): KnowledgeCitation => ({
  index,
  chunkId: `c${index}`,
  informationId: `i${index}`,
  title: `T${index}`,
  url: null,
  type: "ARTICLE",
  score: 1,
});

describe("parseAnswerSegments", () => {
  it("splits text around [n] markers in order", () => {
    expect(parseAnswerSegments("pods scale [1][2].")).toEqual([
      { kind: "text", text: "pods scale " },
      { kind: "cite", index: 1 },
      { kind: "cite", index: 2 },
      { kind: "text", text: "." },
    ]);
  });

  it("returns one text segment when there is no marker", () => {
    expect(parseAnswerSegments("no citations here")).toEqual([
      { kind: "text", text: "no citations here" },
    ]);
  });

  it("keeps a marker-only answer visible instead of dropping it", () => {
    expect(parseAnswerSegments("[3]")).toEqual([{ kind: "cite", index: 3 }]);
  });

  it("does not emit empty text segments at either edge", () => {
    expect(parseAnswerSegments("[1] fact")).toEqual([
      { kind: "cite", index: 1 },
      { kind: "text", text: " fact" },
    ]);
    expect(parseAnswerSegments("fact [1]")).toEqual([
      { kind: "text", text: "fact " },
      { kind: "cite", index: 1 },
    ]);
  });

  it("handles multi-digit indices and returns nothing for an empty answer", () => {
    expect(parseAnswerSegments("see [12]")).toEqual([
      { kind: "text", text: "see " },
      { kind: "cite", index: 12 },
    ]);
    expect(parseAnswerSegments("")).toEqual([]);
  });
});

describe("citedIndices", () => {
  it("dedupes in first-appearance order", () => {
    expect(citedIndices("a [2] b [1] c [2]")).toEqual([2, 1]);
  });

  it("is empty for null / undefined / marker-free answers", () => {
    expect(citedIndices(null)).toEqual([]);
    expect(citedIndices(undefined)).toEqual([]);
    expect(citedIndices("plain")).toEqual([]);
  });
});

describe("citationFor", () => {
  it("resolves a marker index and returns undefined when unresolved", () => {
    const citations = [citation(1), citation(2)];
    expect(citationFor(citations, 2)?.chunkId).toBe("c2");
    expect(citationFor(citations, 9)).toBeUndefined();
  });
});

describe("formatScore", () => {
  it("renders 4 decimals for both RRF (~0.03) and relevance (0–1)", () => {
    expect(formatScore(0.03279)).toBe("0.0328");
    expect(formatScore(1)).toBe("1.0000");
    expect(formatScore(0)).toBe("0.0000");
  });
});

describe("provenanceOf", () => {
  it("lists only the legs that returned the chunk", () => {
    expect(provenanceOf(chunk({ vectorScore: 0.6 }))).toEqual([
      { leg: "vector", score: 0.6 },
    ]);
    expect(provenanceOf(chunk({ keywordScore: 2 }))).toEqual([
      { leg: "keyword", score: 2 },
    ]);
    expect(provenanceOf(chunk({ vectorScore: 0.6, keywordScore: 2 }))).toEqual([
      { leg: "vector", score: 0.6 },
      { leg: "keyword", score: 2 },
    ]);
    expect(provenanceOf(chunk())).toEqual([]);
  });
});

describe("scoreRange", () => {
  it("returns min/max, and 0/0 for an empty set", () => {
    expect(scoreRange([3, 1, 2])).toEqual({ min: 1, max: 3 });
    expect(scoreRange([])).toEqual({ min: 0, max: 0 });
  });
});

describe("relativeBarWidth", () => {
  it("maps the top hit to 100% and floors the lowest at 6%", () => {
    expect(relativeBarWidth(1, 0.031, 1)).toBe(100);
    expect(relativeBarWidth(0.031, 0.031, 1)).toBe(6);
  });

  it("gives a usable spread across a tight RRF range", () => {
    const top = relativeBarWidth(0.03279, 0.03101, 0.03279);
    const mid = relativeBarWidth(0.03175, 0.03101, 0.03279);
    expect(top).toBe(100);
    expect(mid).toBeGreaterThan(6);
    expect(mid).toBeLessThan(top);
  });

  it("returns a full bar when every score is identical", () => {
    expect(relativeBarWidth(0.5, 0.5, 0.5)).toBe(100);
  });
});
