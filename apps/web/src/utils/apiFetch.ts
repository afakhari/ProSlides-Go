import { buildApiUrl } from "./api.ts";

export interface ApiFetchOptions extends RequestInit {
  auth?: boolean;
  json?: unknown;
}

const cookieValue = (name: string): string => {
  if (typeof document === "undefined") return "";
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
};

const hasHeader = (headers: Headers, key: string): boolean => headers.has(key);

export const apiFetch = (path: string, options: ApiFetchOptions = {}): Promise<Response> => {
  const { headers, json, ...init } = options;
  delete init.auth;
  const finalHeaders = new Headers(headers);
  let body = init.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!hasHeader(finalHeaders, "content-type")) finalHeaders.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD"].includes(String(init.method || "GET").toUpperCase())) {
    const csrf = cookieValue("proslides_csrf");
    if (csrf && !hasHeader(finalHeaders, "x-csrf-token")) finalHeaders.set("X-CSRF-Token", csrf);
  }
  return fetch(buildApiUrl(path), { ...init, headers: finalHeaders, body, credentials: "include" });
};
