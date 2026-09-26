import type { AnswerResult, LiveEvent, LiveSessionLocator, LiveSessionResult, LiveSnapshot, ParticipantResult, RosterPage, StageSnapshot } from "./types";
import { createSecureUUID } from "./secureUuid.ts";

const normalizeBase = (value: string) => value.trim().replace(/\/+$/, "");

const getLiveApiBase = () => {
  const configured = import.meta.env?.VITE_LIVE_API_BASE_URL;
  if (configured?.trim()) return normalizeBase(configured);
  return "/api/v1";
};

const liveURL = (path: string) => `${getLiveApiBase()}/${path.replace(/^\/+/, "")}`;
const JSON_REQUEST_TIMEOUT_MS = 15_000;
const SSE_SILENCE_TIMEOUT_MS = 45_000;

const cookieValue = (name: string) => {
  if (typeof document === "undefined") return "";
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
};

export class LiveAPIError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code || `Live API request failed (${status})`);
    this.name = "LiveAPIError";
    this.status = status;
    this.code = code;
  }
}

const requestJSON = async <T>(path: string, init: RequestInit = {}, csrf = false): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (csrf) {
    const token = cookieValue("proslides_csrf");
    if (token) headers.set("X-CSRF-Token", token);
  }

  const timeoutController = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, JSON_REQUEST_TIMEOUT_MS);
  const forwardAbort = () => timeoutController.abort();
  if (init.signal?.aborted) {
    timeoutController.abort();
  } else {
    init.signal?.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    const response = await fetch(liveURL(path), {
      ...init,
      headers,
      credentials: "include",
      signal: timeoutController.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new LiveAPIError(response.status, payload?.error || "live_api_error");
    return payload as T;
  } catch (error) {
    if (timedOut) throw new LiveAPIError(0, "network_timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
};

export const createRequestId = createSecureUUID;

export const createLiveSession = (presentationId: string, requestId: string) => requestJSON<LiveSessionResult>("live/sessions", { method: "POST", body: JSON.stringify({ request_id: requestId, presentation_id: presentationId }) }, true);
export const resolveLiveSession = (joinCode: string) => requestJSON<LiveSessionLocator>(`live/sessions/resolve?join_code=${encodeURIComponent(joinCode)}`);
export const getLiveSnapshot = (id: string) => requestJSON<LiveSnapshot>(`live/sessions/${encodeURIComponent(id)}/snapshot`);
export const getLiveStageSnapshot = (id: string, signal?: AbortSignal) =>
  requestJSON<StageSnapshot>(`live/sessions/${encodeURIComponent(id)}/stage`, { signal });
export const joinLiveSession = (id: string, input: { request_id: string; display_name: string; avatar?: string }) => requestJSON<ParticipantResult>(`live/sessions/${encodeURIComponent(id)}/join`, { method: "POST", body: JSON.stringify(input) });
export const submitLiveAnswer = (
  id: string,
  input: {
    request_id: string;
    activity_item_id: string;
    response:
      | { selected_option_indexes: number[] }
      | { text: string };
  },
) =>
  requestJSON<AnswerResult>(
    `live/sessions/${encodeURIComponent(id)}/answers`,
    { method: "POST", body: JSON.stringify(input) },
  );
export const applyLiveAction = (id: string, input: { request_id: string; expected_state_version: number; action: string; item_id?: string }) => requestJSON<LiveSessionResult>(`live/sessions/${encodeURIComponent(id)}/actions`, { method: "POST", body: JSON.stringify(input) }, true);

export const getRosterPage = (id: string, order: "joined" | "score", cursor = "", limit = 100, signal?: AbortSignal) => {
  const query = new URLSearchParams({ order, limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return requestJSON<RosterPage>(`live/sessions/${encodeURIComponent(id)}/roster?${query}`, { signal });
};

export const streamLiveEvents = async (
  id: string,
  lastEventId: number,
  options: {
    signal: AbortSignal;
    onOpen?: () => void;
    onEvent: (event: LiveEvent) => void;
    silenceTimeoutMs?: number;
  },
) => {
  const response = await fetch(liveURL(`live/sessions/${encodeURIComponent(id)}/events`), {
    headers: { Accept: "text/event-stream", "Last-Event-ID": String(lastEventId) },
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });
  if (!response.ok || !response.body) throw new LiveAPIError(response.status, "event_stream_unavailable");
  options.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const silenceTimeoutMs = options.silenceTimeoutMs ?? SSE_SILENCE_TIMEOUT_MS;
  let buffer = "";

  try {
    while (!options.signal.aborted) {
      let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
      const stalled = new Promise<never>((_, reject) => {
        timeout = globalThis.setTimeout(
          () => reject(new LiveAPIError(0, "event_stream_stalled")),
          silenceTimeoutMs,
        );
      });

      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await Promise.race([reader.read(), stalled]);
      } finally {
        if (timeout !== undefined) globalThis.clearTimeout(timeout);
      }

      const { value, done } = chunk;
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (data) options.onEvent(JSON.parse(data) as LiveEvent);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) return;
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
};
