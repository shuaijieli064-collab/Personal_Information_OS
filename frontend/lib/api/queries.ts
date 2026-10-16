"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  informationApi,
  knowledgeApi,
  signalsApi,
  sourcesApi,
  todayApi,
  type KnowledgeAskParams,
  type KnowledgeSearchParams,
} from "./client";

/** Central query keys — invalidate from anywhere by key. */
export const queryKeys = {
  today: ["today"] as const,
  inbox: ["inbox"] as const,
  sources: ["sources"] as const,
  information: (id: string) => ["information", id] as const,
  discover: ["discover"] as const,
};

export function useToday() {
  return useQuery({
    queryKey: queryKeys.today,
    queryFn: () => todayApi.get(),
  });
}

export function useInbox() {
  return useInfiniteQuery({
    queryKey: queryKeys.inbox,
    queryFn: ({ pageParam }) => informationApi.page(pageParam, 20),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      pages.length * 20 < last.total ? pages.length : undefined,
    placeholderData: (prev) => prev,
  });
}

export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: () => sourcesApi.list(),
  });
}

export function useInformation(id: string) {
  return useQuery({
    queryKey: queryKeys.information(id),
    queryFn: () => informationApi.get(id),
    enabled: Boolean(id),
  });
}

export function useUnderstanding(id: string) {
  return useQuery({
    queryKey: ["understanding", id] as const,
    queryFn: () => informationApi.understanding(id),
    enabled: Boolean(id),
  });
}

/** Signal card actions (save / important / ignore) with optimistic cache refresh. */
export function useSignalAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "save" | "important" | "ignore" }) => {
      if (action === "save") return signalsApi.save(id);
      if (action === "important") return signalsApi.important(id);
      return signalsApi.ignore(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.today });
    },
  });
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type: string; url?: string }) =>
      sourcesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sources }),
  });
}

export function useRemoveSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sourcesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sources }),
  });
}

export function useSyncSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sourcesApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sources });
      qc.invalidateQueries({ queryKey: queryKeys.today });
    },
  });
}

export type DiscoverItem = {
  name: string;
  reason: string;
  category: string;
  confidence: number;
};

/**
 * Discover — AI-recommended sources. GET /api/v1/discover is still planned
 * (docs/API.md, no controller yet), so we serve a deterministic local
 * recommendation layer directly: the page stays interactive and the console
 * stays clean. Re-add the live probe when the endpoint ships.
 */
export function useDiscover() {
  return useQuery({
    queryKey: queryKeys.discover,
    queryFn: async (): Promise<DiscoverItem[]> => [
      { name: "Spring AI", reason: "You follow Java · AI backend", category: "Library", confidence: 92 },
      { name: "Project Reactor", reason: "Reactive pipelines match your stack", category: "Library", confidence: 87 },
      { name: "JVM Internals", reason: "Deepens your backend foundation", category: "Learning", confidence: 84 },
      { name: "LangChain4j", reason: "LLM tooling aligned with your goals", category: "Library", confidence: 79 },
    ],
  });
}

/* ── Phase 6 Knowledge (K3 search / K4 RAG) ───────────────────────────────── */

/**
 * Search and ask are mutations, not queries: they are user-triggered, run once
 * per submit, and must not be refetched on window focus or cache-key churn.
 */
export function useKnowledgeSearch() {
  return useMutation({
    mutationFn: (params: KnowledgeSearchParams) => knowledgeApi.search(params),
  });
}

export function useKnowledgeAsk() {
  return useMutation({
    mutationFn: (params: KnowledgeAskParams) => knowledgeApi.ask(params),
  });
}

/** Rebuild the caller's chunk corpus, then refresh Today (new chunks can move signals). */
export function useKnowledgeReindex() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => knowledgeApi.reindex(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.today });
      qc.invalidateQueries({ queryKey: queryKeys.inbox });
    },
  });
}
