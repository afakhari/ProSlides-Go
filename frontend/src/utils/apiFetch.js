import { buildApiUrl } from "./api";
import { clearAuthStorage, getAuthHeaders, getRefreshToken } from "./auth";

const hasHeader = (headers, key) =>
  Object.keys(headers || {}).some((header) => header.toLowerCase() === key);

const refreshAccessToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const response = await fetch(buildApiUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearAuthStorage();
    return null;
  }
  const payload = await response.json().catch(() => null);
  if (payload?.access) {
    localStorage.setItem("auth.access", payload.access);
    return payload.access;
  }
  clearAuthStorage();
  return null;
};

const executeFetch = async (path, options, didRefresh) => {
  const { auth = true, headers = {}, json, ...init } = options;
  const finalHeaders = { ...headers };

  if (auth && !hasHeader(finalHeaders, "authorization")) {
    Object.assign(finalHeaders, getAuthHeaders());
  }

  let body = init.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!hasHeader(finalHeaders, "content-type")) {
      finalHeaders["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: finalHeaders,
    body,
  });

  if (auth && response.status === 401 && !didRefresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return executeFetch(path, { ...options }, true);
    }
  }

  return response;
};

export const apiFetch = (path, options = {}) =>
  executeFetch(path, options, false);
