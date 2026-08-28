import { apiFetch, type ApiFetchOptions } from "../../utils/apiFetch.ts";

export type ApiErrorPayload = Record<string, unknown> | null;
export type ApiRequestOptions = ApiFetchOptions;

export class ApiError extends Error {
  readonly status: number;
  readonly data: ApiErrorPayload;
  readonly code: string;
  readonly response: { status: number; data: ApiErrorPayload };

  constructor(status: number, payload: ApiErrorPayload) {
    const code = typeof payload?.error === "string" ? payload.error : "http_error";
    super(typeof payload?.message === "string" ? payload.message : code === "http_error" ? `HTTP ${status}` : code);
    this.name = "ApiError";
    this.status = status;
    this.data = payload;
    this.code = code;
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

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload;
  if (!response.ok) {
    if (response.status === 401) announceAuthExpiry();
    throw new ApiError(response.status, payload);
  }
  return payload as T;
}
