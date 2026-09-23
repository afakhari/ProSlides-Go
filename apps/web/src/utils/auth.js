export const clearAuthStorage = () => {
  localStorage.removeItem("auth.access");
  localStorage.removeItem("auth.refresh");
  localStorage.removeItem("auth.name");
  localStorage.removeItem("auth.email");
  localStorage.removeItem("auth.promptSetPassword");
};

export const AUTH_EXPIRED_EVENT = "auth:expired";
export const AUTH_EXPIRED_STORAGE_KEY = "auth.expiredAt";
export const APP_NOTICE_EVENT = "app:notice";

let authExpiredDispatched = false;
let lastNotice = { code: "", at: 0 };
const NOTICE_THROTTLE_MS = 2000;

export const notifyAppNotice = (key, tone = "info") => {
  if (typeof window === "undefined") return;
  if (!key) return;
  const now = Date.now();
  if (lastNotice.code === key && now - lastNotice.at < NOTICE_THROTTLE_MS) {
    return;
  }
  lastNotice = { code: key, at: now };
  window.dispatchEvent(
    new CustomEvent(APP_NOTICE_EVENT, {
      detail: { code: key, tone },
    })
  );
};

export const notifyAuthExpired = (reason = "session-expired") => {
  if (authExpiredDispatched || typeof window === "undefined") return;
  authExpiredDispatched = true;
  const tone = reason === "session-revoked" ? "error" : "warning";
  notifyAppNotice(reason, tone);
  try {
    localStorage.setItem(
      AUTH_EXPIRED_STORAGE_KEY,
      JSON.stringify({ reason, at: Date.now() })
    );
  } catch (error) {
    console.warn("Failed to persist auth expiry signal.", error);
  }
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } })
  );
};

export const resetAuthExpiredFlag = () => {
  authExpiredDispatched = false;
  try {
    localStorage.removeItem(AUTH_EXPIRED_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear auth expiry signal.", error);
  }
};
