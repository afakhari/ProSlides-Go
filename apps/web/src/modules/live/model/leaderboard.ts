export interface LeaderboardEnvelope {
  results?: unknown[];
}

export function hasLeaderboardEntries(payload: unknown): boolean {
  if (!payload) return false;
  if (Array.isArray(payload)) return payload.length > 0;

  if (typeof payload === "object" && "results" in payload) {
    const results = (payload as LeaderboardEnvelope).results;
    return Array.isArray(results) && results.length > 0;
  }

  return false;
}
