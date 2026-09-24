import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import Notice from "../../../shared/ui/Notice.tsx";
import { identityApi } from "../api/identityApi.ts";
import { identityErrorMessage } from "../api/identityErrors.ts";
import { currentSessionQuery } from "../api/sessionQuery.ts";
import { PASSWORD_PROMPT_FLAG } from "../model/authFlow.ts";

type PromptStatus =
  | { tone: "error" | "success"; message: string }
  | null;

const hasPromptFlag = (): boolean => {
  try {
    return localStorage.getItem(PASSWORD_PROMPT_FLAG) === "1";
  } catch {
    return false;
  }
};

const clearPromptFlag = () => {
  try {
    localStorage.removeItem(PASSWORD_PROMPT_FLAG);
  } catch {
    // Persistence is best-effort. The current page can still hide the prompt.
  }
};

export function PasswordSetupPrompt() {
  const { data: user } = useQuery(currentSessionQuery());
  const [visible, setVisible] = useState(hasPromptFlag);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<PromptStatus>(null);

  useEffect(() => {
    if (!status || status.tone === "error") return;
    const timeoutId = window.setTimeout(() => setStatus(null), 6_000);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const requestSetupLink = async () => {
    const email = user?.email?.trim();
    if (!email) {
      setStatus({
        tone: "error",
        message: "نشانی ایمیل حساب در دسترس نیست. دوباره وارد حساب شوید.",
      });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      await identityApi.requestPasswordReset({ email });
      clearPromptFlag();
      setVisible(false);
      setStatus({
        tone: "success",
        message:
          "لینک تعیین رمز عبور ارسال شد. صندوق ورودی ایمیل خود را بررسی کنید.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: identityErrorMessage(
          error,
          "ارسال لینک تعیین رمز عبور انجام نشد.",
        ),
      });
    } finally {
      setSending(false);
    }
  };

  if (!visible && !status) return null;

  return (
    <div className="mb-6 space-y-2">
      {visible ? (
        <section className="rounded-panel border border-brand-border bg-surface px-4 py-4 text-sm text-brand-ink shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold">برای حساب خود رمز عبور تعیین کنید</h2>
              <p className="mt-1 text-xs leading-6 text-brand-strong">
                اگر با گوگل ثبت‌نام کرده‌اید، با تعیین رمز عبور می‌توانید از
                ورود ایمیلی هم استفاده کنید.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void requestSetupLink()}
                disabled={sending}
                className="inline-flex min-h-10 items-center gap-2 rounded-control bg-brand px-3 py-2 text-xs font-semibold text-content-inverse transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-70"
                aria-busy={sending || undefined}
              >
                {sending ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
                {sending ? "در حال ارسال…" : "ارسال لینک"}
              </button>
              <button
                type="button"
                onClick={() => setVisible(false)}
                disabled={sending}
                className="min-h-10 rounded-control border border-brand-border px-3 py-2 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
              >
                بعداً
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {status ? (
        <Notice tone={status.tone}>{status.message}</Notice>
      ) : null}
    </div>
  );
}
