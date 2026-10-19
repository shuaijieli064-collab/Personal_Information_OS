"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  agentApi,
  automationApi,
  briefApi,
  informationApi,
  knowledgeApi,
  notificationApi,
  profileApi,
  signalsApi,
  sourcesApi,
  todayApi,
  type JobType,
  type KnowledgeAskParams,
  type KnowledgeSearchParams,
} from "./client";

/** Central query keys — invalidate from anywhere by key. */
export const queryKeys = {
  today: ["today"] as const,
  inbox: ["inbox"] as const,
  inboxIgnored: ["inbox", "ignored"] as const,
  sources: ["sources"] as const,
  information: (id: string) => ["information", id] as const,
  discover: ["discover"] as const,
  agentTools: ["agent", "tools"] as const,
  agentRunsAll: ["agent", "runs"] as const,
  agentRuns: (page: number) => ["agent", "runs", page] as const,
  agentRun: (id: string) => ["agent", "run", id] as const,
  automationJobs: ["automation", "jobs"] as const,
  jobRunsAll: ["automation", "runs"] as const,
  jobRuns: (id: string) => ["automation", "runs", id] as const,
  briefLatest: ["brief", "latest"] as const,
  notificationsAll: ["notifications"] as const,
  notifications: (unread: boolean) => ["notifications", unread] as const,
  profile: ["profile"] as const,
  goals: ["goals"] as const,
  interests: ["interests"] as const,
  skills: ["skills"] as const,
  knowledgeStats: ["knowledge", "stats"] as const,
};

export function useToday() {
  return useQuery({
    queryKey: queryKeys.today,
    queryFn: () => todayApi.get(),
  });
}

/**
 * The review list: ACTIVE (untouched) plus KEPT (explicitly kept — the user still wants to
 * see it). ARCHIVED is excluded here and fetched separately, because dismissed rows must
 * not eat page slots in the list you actually work through.
 */
export function useInbox() {
  return useInfiniteQuery({
    queryKey: queryKeys.inbox,
    queryFn: ({ pageParam }) => informationApi.page(pageParam, 20, "ACTIVE,KEPT"),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      pages.length * 20 < last.total ? pages.length : undefined,
    placeholderData: (prev) => prev,
  });
}

/** Dismissed rows, so "ignore" has somewhere to go and can be undone. */
export function useIgnoredInbox() {
  return useQuery({
    queryKey: queryKeys.inboxIgnored,
    queryFn: () => informationApi.page(0, 10, "ARCHIVED"),
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
  /** i18n key suffix under `Discover.reason` — never prose. */
  reasonKey: string;
  /** i18n key suffix under `Discover.category`. */
  categoryKey: string;
  confidence: number;
};

/**
 * Discover — AI-recommended sources. GET /api/v1/discover is still planned
 * (docs/ROADMAP.md, no controller yet), so the card set is a deterministic local
 * placeholder and stays that way until the endpoint ships. Everything a user can
 * *read* is an i18n key resolved by the page — only the product names are
 * literal, because they are proper nouns in both locales.
 */
export function useDiscover() {
  return useQuery({
    queryKey: queryKeys.discover,
    queryFn: async (): Promise<DiscoverItem[]> => [
      { name: "Spring AI", reasonKey: "springAi", categoryKey: "library", confidence: 92 },
      { name: "Project Reactor", reasonKey: "projectReactor", categoryKey: "library", confidence: 87 },
      { name: "JVM Internals", reasonKey: "jvmInternals", categoryKey: "learning", confidence: 84 },
      { name: "LangChain4j", reasonKey: "langchain4j", categoryKey: "library", confidence: 79 },
    ],
  });
}

/* ── Personalisation graph ─────────────────────────────────────────────── */

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => profileApi.get(),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: () => profileApi.goals(),
  });
}

export function useInterests() {
  return useQuery({
    queryKey: queryKeys.interests,
    queryFn: () => profileApi.interests(),
  });
}

export function useSkills() {
  return useQuery({
    queryKey: queryKeys.skills,
    queryFn: () => profileApi.skills(),
  });
}

/* ── Phase 6 Knowledge (K3 search / K4 RAG) ───────────────────────────────── */

/** Corpus shape for the first screen — cheap counts, refetched after a reindex. */
export function useKnowledgeStats() {
  return useQuery({
    queryKey: queryKeys.knowledgeStats,
    queryFn: () => knowledgeApi.stats(),
  });
}

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
      qc.invalidateQueries({ queryKey: queryKeys.knowledgeStats });
    },
  });
}

/* ── Phase 7 Agent & tools ────────────────────────────────────────────────── */

/** The tool catalogue — static per deployment, so a plain query is enough. */
export function useAgentTools() {
  return useQuery({
    queryKey: queryKeys.agentTools,
    queryFn: () => agentApi.tools(),
    staleTime: Infinity,
  });
}

export function useAgentRuns(page = 0, size = 10) {
  return useQuery({
    queryKey: queryKeys.agentRuns(page),
    queryFn: () => agentApi.list(page, size),
  });
}

/**
 * One run, with its steps. Enabled only when an id is selected, so the console does not
 * fetch anything until the user opens a run.
 */
export function useAgentRun(id: string | null) {
  return useQuery({
    queryKey: queryKeys.agentRun(id ?? ""),
    queryFn: () => agentApi.get(id as string),
    enabled: id !== null,
  });
}

/**
 * Starting a run, confirming a step and rejecting a run all return the whole updated
 * run, so the mutation result is written straight into the cache — no refetch, and the
 * run survives a page navigation.
 */
export function useAgentCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { goal: string; maxSteps?: number }) => agentApi.create(body),
    onSuccess: (run) => {
      qc.setQueryData(queryKeys.agentRun(run.id), run);
      qc.invalidateQueries({ queryKey: queryKeys.agentRunsAll });
    },
  });
}

export function useAgentConfirmStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; stepId?: string; note?: string }) =>
      agentApi.confirm(id, body),
    onSuccess: (run) => {
      qc.setQueryData(queryKeys.agentRun(run.id), run);
      qc.invalidateQueries({ queryKey: queryKeys.agentRunsAll });
    },
  });
}

export function useAgentRejectRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; reason?: string }) =>
      agentApi.reject(id, body),
    onSuccess: (run) => {
      qc.setQueryData(queryKeys.agentRun(run.id), run);
      qc.invalidateQueries({ queryKey: queryKeys.agentRunsAll });
    },
  });
}

/* ── Phase 8 Automation, brief & notifications ───────────────────────────── */

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.automationJobs,
    queryFn: () => automationApi.jobs(),
  });
}

/** Run history for one job; disabled until the user expands a job. */
export function useJobRuns(jobId: string | null, size = 20) {
  return useQuery({
    queryKey: queryKeys.jobRuns(jobId ?? ""),
    queryFn: () => automationApi.runs(jobId as string, 0, size),
    enabled: jobId !== null,
  });
}

/** Creating a job type that already exists rewrites it, so both paths refresh the list. */
export function useUpsertJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: JobType; intervalMinutes?: number; enabled?: boolean }) =>
      automationApi.upsertJob(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.automationJobs }),
  });
}

export function usePatchJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; intervalMinutes?: number; enabled?: boolean }) =>
      automationApi.patchJob(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.automationJobs }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationApi.deleteJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automationJobs });
      qc.invalidateQueries({ queryKey: queryKeys.jobRunsAll });
    },
  });
}

/**
 * A manual run returns the fresh run, so we refresh both the run history of that job and
 * the job itself (last_run_at / next_run_at / failure count all move).
 */
export function useRunJobNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationApi.runJob(id),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryKeys.jobRuns(run.jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.automationJobs });
      qc.invalidateQueries({ queryKey: queryKeys.notificationsAll });
      qc.invalidateQueries({ queryKey: queryKeys.today });
    },
  });
}

/** Retrying a dead run re-enables its job, so the job list has to refresh too. */
export function useRetryRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationApi.retryRun(id),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryKeys.jobRuns(run.jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.automationJobs });
    },
  });
}

export function useLatestBrief() {
  return useQuery({
    queryKey: queryKeys.briefLatest,
    queryFn: () => briefApi.latest(),
  });
}

export function useGenerateBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => briefApi.generate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.briefLatest });
      qc.invalidateQueries({ queryKey: queryKeys.notificationsAll });
    },
  });
}

export function useNotifications(unread = false, size = 20) {
  return useQuery({
    queryKey: queryKeys.notifications(unread),
    queryFn: () => notificationApi.list(unread, 0, size),
  });
}

/** Marking one read only moves the badge, so both the filtered and unfiltered lists refresh. */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.read(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.readAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  });
}
