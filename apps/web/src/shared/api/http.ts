import type { components } from "./generated/openapi.ts";

type ErrorDTO = components["schemas"]["Error"];

const DEFAULT_API_BASE = "/api/v1";

export type ApiErrorPayload = ErrorDTO | null;

export type ApiRequestOptions = RequestInit & {
  json?: unknown;
  announceAuthExpiry?: boolean;
};

const normalizeBase = (base: string): string => base.trim().replace(/\/+$/, "");

export const getApiBase = (): string => {
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  return envBase && envBase.trim() ? normalizeBase(envBase) : DEFAULT_API_BASE;
};

export const buildApiUrl = (path = ""): string => {
  const base = getApiBase();
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) {
    throw new TypeError("API request paths must be relative to the configured base URL.");
  }

  return `${base}/${path.replace(/^\/+/, "")}`;
};

const cookieValue = (name: string): string => {
  if (typeof document === "undefined") return "";

  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));

  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
};

const normalizeFieldErrors = (
  value: unknown,
): Record<string, string[]> | undefined => {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value)
    .map(
      ([field, messages]) =>
        [
          field,
          Array.isArray(messages)
            ? messages.filter(
                (message): message is string => typeof message === "string",
              )
            : [],
        ] as const,
    )
    .filter(([, messages]) => messages.length > 0);

  return entries.length ? Object.fromEntries(entries) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeApiErrorPayload = (value: unknown): ApiErrorPayload => {
  if (!isRecord(value) || typeof value.error !== "string") return null;

  const payload: ErrorDTO = { error: value.error };

  if (typeof value.message === "string") payload.message = value.message;

  const fieldErrors = normalizeFieldErrors(value.field_errors);
  if (fieldErrors) payload.field_errors = fieldErrors;

  if (
    Number.isFinite(value.retry_after_seconds) &&
    Number(value.retry_after_seconds) >= 0
  ) {
    payload.retry_after_seconds = Number(value.retry_after_seconds);
  }

  if (typeof value.request_id === "string") payload.request_id = value.request_id;

  return payload;
};

export class ApiError extends Error {
  readonly status: number;
  readonly data: ApiErrorPayload;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly retryAfterSeconds: number | null;
  readonly requestId: string | null;
  readonly response: { status: number; data: ApiErrorPayload };

  constructor(status: number, payload: ApiErrorPayload) {
    const code = payload?.error || "http_error";
    super(payload?.message || (code === "http_error" ? `HTTP ${status}` : code));

    this.name = "ApiError";
    this.status = status;
    this.data = payload;
    this.code = code;
    this.fieldErrors = payload?.field_errors || {};
    this.retryAfterSeconds = payload?.retry_after_seconds ?? null;
    this.requestId = payload?.request_id ?? null;
    this.response = { status, data: payload };
  }

  get isConflict(): boolean {
    return this.status === 409 && this.code === "edit_conflict";
  }
}

const announceAuthExpiry = () => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("app:notice", {
      detail: { code: "session-expired", tone: "warning" },
    }),
  );
};

const request = async (
  path: string,
  options: Omit<ApiRequestOptions, "announceAuthExpiry">,
): Promise<Response> => {
  const { headers, json, ...init } = options;
  const finalHeaders = new Headers(headers);
  let body = init.body;

  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!finalHeaders.has("content-type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
  }

  const method = String(init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf = cookieValue("proslides_csrf");
    if (csrf && !finalHeaders.has("x-csrf-token")) {
      finalHeaders.set("X-CSRF-Token", csrf);
    }
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers: finalHeaders,
    body,
    credentials: "include",
  });
};

export async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    announceAuthExpiry: shouldAnnounceAuthExpiry = true,
    ...requestOptions
  } = options;

  const response = await request(path, requestOptions);
  if (response.status === 204) return undefined as T;

  const rawPayload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && shouldAnnounceAuthExpiry) {
      announceAuthExpiry();
    }

    throw new ApiError(
      response.status,
      normalizeApiErrorPayload(rawPayload),
    );
  }

  return rawPayload as T;
}
