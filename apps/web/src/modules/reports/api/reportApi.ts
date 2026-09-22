import { ApiError, requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

export type ReportPresentation = components["schemas"]["Presentation"];
export type ReportSessionLocator = components["schemas"]["LiveSessionLocator"];
export type ReportRosterPage = components["schemas"]["RosterPage"];

export const reportApi = {
  getPresentation: (presentationId: string, signal?: AbortSignal) =>
    requestJson<ReportPresentation>(`/presentations/${encodeURIComponent(presentationId)}`, { signal }),

  getLatestSession: async (
    presentationId: string,
    signal?: AbortSignal,
  ): Promise<ReportSessionLocator | null> => {
    try {
      return await requestJson<ReportSessionLocator>(
        `/presentations/${encodeURIComponent(presentationId)}/latest-session`,
        { signal },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  getRosterPage: (
    sessionId: string,
    cursor = "",
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({ order: "score", limit: "100" });
    if (cursor) query.set("cursor", cursor);
    return requestJson<ReportRosterPage>(
      `/live/sessions/${encodeURIComponent(sessionId)}/roster?${query}`,
      { signal },
    );
  },
};
