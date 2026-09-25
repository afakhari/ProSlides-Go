import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { reportApi } from "./reportApi.ts";

export const reportKeys = {
  root: ["reports"] as const,
  sessions: (presentationId: string) =>
    [...reportKeys.root, "sessions", presentationId] as const,
  session: (presentationId: string, sessionId: string) =>
    [...reportKeys.root, "session", presentationId, sessionId] as const,
  activity: (
    presentationId: string,
    sessionId: string,
    activityItemId: string,
  ) =>
    [
      ...reportKeys.root,
      "activity",
      presentationId,
      sessionId,
      activityItemId,
    ] as const,
  ranking: (presentationId: string, sessionId: string) =>
    [...reportKeys.root, "ranking", presentationId, sessionId] as const,
};

export const reportSessionsQuery = (presentationId: string) =>
  infiniteQueryOptions({
    queryKey: reportKeys.sessions(presentationId),
    queryFn: ({ pageParam, signal }) =>
      reportApi.getSessionsPage(presentationId, pageParam, signal),
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor || undefined : undefined,
    staleTime: 30_000,
  });

export const reportSessionQuery = (
  presentationId: string,
  sessionId: string,
) =>
  queryOptions({
    queryKey: reportKeys.session(presentationId, sessionId),
    queryFn: ({ signal }) =>
      reportApi.getSessionReport(presentationId, sessionId, signal),
    staleTime: 15_000,
  });

export const reportActivityQuery = (
  presentationId: string,
  sessionId: string,
  activityItemId: string,
) =>
  infiniteQueryOptions({
    queryKey: reportKeys.activity(
      presentationId,
      sessionId,
      activityItemId,
    ),
    queryFn: ({ pageParam, signal }) =>
      reportApi.getActivityPage(
        presentationId,
        sessionId,
        activityItemId,
        pageParam,
        signal,
      ),
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor || undefined : undefined,
    staleTime: 15_000,
  });

export const reportRankingQuery = (
  presentationId: string,
  sessionId: string,
) =>
  infiniteQueryOptions({
    queryKey: reportKeys.ranking(presentationId, sessionId),
    queryFn: ({ pageParam, signal }) =>
      reportApi.getRankingPage(presentationId, sessionId, pageParam, signal),
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor || undefined : undefined,
    staleTime: 15_000,
  });
