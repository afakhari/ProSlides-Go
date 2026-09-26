import { requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

type ReportSessionPage = components["schemas"]["ReportSessionPage"];
export type ReportSessionSummary = components["schemas"]["ReportSessionSummary"];
type ReportSession = components["schemas"]["SessionReport"];
export type ReportActivityPage = components["schemas"]["ReportActivityPage"];
export type ReportActivitySummary = components["schemas"]["ReportActivitySummary"];
export type ReportRankingPage = components["schemas"]["ReportRankingPage"];
export type ReportActivityResponse = components["schemas"]["ReportActivityResponse"];

const pageQuery = (cursor = "", limit = 50) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return query.toString();
};

export const reportApi = {
  getSessionsPage: (
    presentationId: string,
    cursor = "",
    signal?: AbortSignal,
  ) =>
    requestJson<ReportSessionPage>(
      `/presentations/${encodeURIComponent(presentationId)}/sessions?${pageQuery(cursor, 20)}`,
      { signal },
    ),

  getSessionReport: (
    presentationId: string,
    sessionId: string,
    signal?: AbortSignal,
  ) =>
    requestJson<ReportSession>(
      `/presentations/${encodeURIComponent(presentationId)}/sessions/${encodeURIComponent(sessionId)}/report`,
      { signal },
    ),

  getActivityPage: (
    presentationId: string,
    sessionId: string,
    activityItemId: string,
    cursor = "",
    signal?: AbortSignal,
  ) =>
    requestJson<ReportActivityPage>(
      `/presentations/${encodeURIComponent(presentationId)}/sessions/${encodeURIComponent(sessionId)}/activities/${encodeURIComponent(activityItemId)}/results?${pageQuery(cursor)}`,
      { signal },
    ),

  getRankingPage: (
    presentationId: string,
    sessionId: string,
    cursor = "",
    signal?: AbortSignal,
  ) =>
    requestJson<ReportRankingPage>(
      `/presentations/${encodeURIComponent(presentationId)}/sessions/${encodeURIComponent(sessionId)}/ranking?${pageQuery(cursor)}`,
      { signal },
    ),
};
