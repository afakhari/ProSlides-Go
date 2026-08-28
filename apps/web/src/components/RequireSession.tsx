import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";

type SessionState = "loading" | "anonymous" | "authenticated";
type RequireSessionProps = { children: ReactNode };
type CurrentUser = { display_name?: string; email?: string };

export default function RequireSession({ children }: RequireSessionProps) {
  const location = useLocation();
  const [state, setState] = useState<SessionState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/auth/me", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setState("anonymous");
          return;
        }
        const user = (await response.json()) as CurrentUser;
        localStorage.setItem("auth.name", user.display_name || "You");
        localStorage.setItem("auth.email", user.email || "");
        setState("authenticated");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState("anonymous");
        }
      });
    return () => controller.abort();
  }, []);

  if (state === "loading") return <div className="min-h-screen bg-surface" aria-busy="true" />;
  if (state === "anonymous") {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
}
