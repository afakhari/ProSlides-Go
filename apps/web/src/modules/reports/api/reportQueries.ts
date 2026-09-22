import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { reportApi } from "./reportApi.ts";

export const reportKeys = {
  root: ["reports"] as const,
  presentation: (presentationId: string) =>
    [...reportKeys.root, "presentation", presentationId] as const,
  latestSession: (presentationId: string) =>
    [...reportKeys.root, "latest-session", presentationId] as const,
  roster: (presentationId: string, sessionId: string) =>
    [...reportKeys.root, "roster", presentationId, sessionId] as const,
};

export const reportPresentationQuery = (presentationId: string) =>
  queryOptions({
    queryKey: reportKeys.presentation(presentationId),
    queryFn: ({ signal }) => reportApi.getPresentation(presentationId, signal),
    staleTime: 60_000,
  });

export const reportLatestSessionQuery = (presentationId: string) =>
  queryOptions({
    queryKey: reportKeys.latestSession(presentationId),
    queryFn: ({ signal }) => reportApi.getLatestSession(presentationId, signal),
    refetchInterval: 15 * 60_000,
  });

export const reportRosterQuery = (
  presentationId: string,
  sessionId: string,
) =>
  infiniteQueryOptions({
    queryKey: reportKeys.roster(presentationId, sessionId),
    queryFn: ({ pageParam, signal }) =>
      reportApi.getRosterPage(sessionId, pageParam, signal),
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor || undefined : undefined,
    refetchInterval: 15 * 60_000,
  });
