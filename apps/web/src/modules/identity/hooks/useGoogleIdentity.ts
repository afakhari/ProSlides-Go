import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getGooglePromptFeedback,
  type AuthStatus,
} from "../model/authFlow.ts";

const GOOGLE_COOKIE_HELP_URL =
  "https://support.google.com/accounts/answer/61416?hl=en";
const GOOGLE_SCRIPT_ID = "google-identity";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = {
  credential?: string;
};

type GooglePromptNotification = {
  getMomentType?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
};

type GoogleIdentityClient = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: "popup";
    use_fedcm_for_prompt: boolean;
  }) => void;
  prompt: (callback: (notification: GooglePromptNotification) => void) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityClient;
      };
    };
  }
}

type UseGoogleIdentityOptions = {
  clientId: string;
  onCredential: (credential: string) => void | Promise<void>;
  onStatus: (status: AuthStatus) => void;
};

const getCookieSettingsUrl = (): string => {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";

  if (ua.includes("Edg/")) return "edge://settings/content/cookies";
  if (ua.includes("Firefox/")) return "about:preferences#privacy";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
    return "chrome://settings/cookies";
  }
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    return "https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac";
  }
  return "";
};

const promptReason = (notification: GooglePromptNotification): string => {
  const momentType = notification.getMomentType?.();
  if (momentType === "skipped") return notification.getSkippedReason?.() || "";
  if (momentType === "dismissed") {
    return notification.getDismissedReason?.() || "";
  }
  return "";
};

export function useGoogleIdentity({
  clientId,
  onCredential,
  onStatus,
}: UseGoogleIdentityOptions) {
  const [ready, setReady] = useState(false);
  const cookieSettingsUrl = useMemo(getCookieSettingsUrl, []);
  const cookieSettingsLabel = cookieSettingsUrl
    ? "باز کردن تنظیمات کوکی"
    : "راهنمای کوکی‌ها";

  useEffect(() => {
    if (!clientId) {
      setReady(false);
      return;
    }

    const initialize = () => {
      const identity = window.google?.accounts?.id;
      if (!identity) return;

      const shouldUseFedcm =
        window.isSecureContext &&
        !["localhost", "127.0.0.1"].includes(window.location.hostname);

      identity.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) {
            onStatus({
              type: "error",
              message: "ورود با گوگل توکن معتبری برنگرداند.",
            });
            return;
          }
          void onCredential(response.credential);
        },
        ux_mode: "popup",
        use_fedcm_for_prompt: shouldUseFedcm,
      });
      setReady(true);
    };

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      if (window.google?.accounts?.id) {
        initialize();
        return;
      }

      existingScript.addEventListener("load", initialize, { once: true });
      return () => existingScript.removeEventListener("load", initialize);
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => {
      setReady(false);
      onStatus({
        type: "error",
        message: "در حال حاضر امکان بارگذاری ورود با گوگل وجود ندارد.",
      });
    };
    document.body.appendChild(script);
  }, [clientId, onCredential, onStatus]);

  const signIn = useCallback(() => {
    if (!clientId) {
      onStatus({
        type: "error",
        message: "ورود با گوگل برای این سایت پیکربندی نشده است.",
      });
      return;
    }

    const identity = window.google?.accounts?.id;
    if (!ready || !identity) {
      onStatus({
        type: "error",
        message: "ورود با گوگل هنوز در حال بارگذاری است. لطفاً دوباره تلاش کنید.",
      });
      return;
    }

    if (navigator.cookieEnabled === false) {
      onStatus({
        type: "google-cookies",
        message:
          "ورود با گوگل به‌دلیل غیرفعال بودن کوکی‌های مرورگر در دسترس نیست. کوکی‌ها را فعال کنید و دوباره تلاش کنید.",
      });
      return;
    }

    onStatus(null);
    identity.prompt((notification) => {
      const feedback = getGooglePromptFeedback(promptReason(notification));
      if (feedback) onStatus(feedback);
    });
  }, [clientId, onStatus, ready]);

  const openCookieSettings = useCallback(() => {
    window.open(
      cookieSettingsUrl || GOOGLE_COOKIE_HELP_URL,
      "_blank",
      "noopener,noreferrer",
    );
  }, [cookieSettingsUrl]);

  const openCookieHelp = useCallback(() => {
    window.open(GOOGLE_COOKIE_HELP_URL, "_blank", "noopener,noreferrer");
  }, []);

  return {
    signIn,
    cookieSettingsUrl,
    cookieSettingsLabel,
    openCookieSettings,
    openCookieHelp,
  };
}
