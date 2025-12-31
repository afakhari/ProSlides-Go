const DEFAULT_API_BASE = "https://api.proslides.ir/api";
const LOCAL_API_BASE = "http://127.0.0.1:8000/api";

const normalizeBase = (base) => {
  if (!base) return "";
  return base.trim().replace(/\/+$/, "");
};

export const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase && envBase.trim()) {
    return normalizeBase(envBase);
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return normalizeBase(LOCAL_API_BASE);
    }
  }
  return normalizeBase(DEFAULT_API_BASE);
};

export const buildApiUrl = (path = "") => {
  const base = getApiBase();
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${normalizedPath}`;
};
