import { apiFetch, type ApiFetchOptions } from "../../utils/apiFetch.ts";
import type { components } from "./generated/openapi.ts";

type ErrorDTO = components["schemas"]["Error"];

export type ApiErrorPayload = ErrorDTO | null;
export type ApiRequestOptions = ApiFetchOptions;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeFieldErrors = (value: unknown): Record<string, string[]> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .map(([field, messages]) => [
      field,
      Array.isArray(messages)
        ? messages.filter((message): message is string => typeof message === "string")
        : [],
    ] as const)
    .filter(([, messages]) => messages.length > 0);
  return entries.length ? Object.fromEntries(entries) : undefined;
};

export const normalizeApiErrorPayload = (value: unknown): ApiErrorPayload => {
  if (!isRecord(value) || typeof value.error !== "string") return null;
  const payload: ErrorDTO = { error: value.error };

  if (typeof value.message === "string") payload.message = value.message;
  const fieldErrors = normalizeFieldErrors(value.field_errors);
  if (fieldErrors) payload.field_errors = fieldErrors;
  if (Number.isFinite(value.retry_after_seconds) && Number(value.retry_after_seconds) >= 0) {
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
  window.dispatchEvent(new CustomEvent("app:notice", {
    detail: { code: "session-expired", tone: "warning" },
  }));
};

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (response.status === 204) return undefined as T;

  const rawPayload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) announceAuthExpiry();
    throw new ApiError(response.status, normalizeApiErrorPayload(rawPayload));
  }
  return rawPayload as T;
}
