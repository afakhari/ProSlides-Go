export const DEFAULT_OTP_TTL_SECONDS = 600;
export const PASSWORD_PROMPT_FLAG = "auth.promptSetPassword";

export type AuthMode = "login" | "signup" | "verify";

export type AuthStatusType =
  | "error"
  | "info"
  | "network"
  | "google-cookies"
  | "email-exists"
  | "otp-expired";

export type AuthStatus = {
  type: AuthStatusType;
  message: string;
} | null;

export type AuthFormValues = {
  email: string;
  password: string;
  verificationCode: string;
  fullName: string;
};

export type PasswordStrength = {
  score: number;
  label: "ضعیف" | "متوسط" | "خوب" | "قوی";
};

const payloadNumber = (payload: unknown, key: string): number | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

export const resolveAuthMode = (pathname: string, search: string): AuthMode => {
  const params = new URLSearchParams(search);
  const queryMode = params.get("mode");
  if (queryMode === "signup" || queryMode === "login") return queryMode;
  if (pathname === "/signup") return "signup";
  return "login";
};

export const getPasswordStrength = (value: string): PasswordStrength => {
  if (!value) return { score: 0, label: "ضعیف" };

  const length = value.length;
  const variety = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (variety >= 2) score += 1;
  if (variety >= 3) score += 1;

  const label =
    score >= 4 ? "قوی" : score === 3 ? "خوب" : score === 2 ? "متوسط" : "ضعیف";
  return { score, label };
};

export const getResendSeconds = (
  payload: unknown,
  fallbackSeconds: number,
): number => {
  const seconds =
    payloadNumber(payload, "retry_after_seconds") ??
    payloadNumber(payload, "resend_seconds") ??
    fallbackSeconds;
  return Math.max(0, Math.floor(seconds));
};

export const getOtpExpirySeconds = (
  payload: unknown,
  fallbackSeconds: number,
): number => {
  const seconds =
    payloadNumber(payload, "code_expires_in_seconds") ?? fallbackSeconds;
  return Math.max(0, Math.floor(seconds));
};

export const formatCountdown = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return String(minutes) + ":" + String(seconds).padStart(2, "0");
};

export const maskEmail = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.includes("@")) return trimmed;

  const [name, domain] = trimmed.split("@");
  if (!name || !domain) return trimmed;

  const safeName =
    name.length <= 2 ? (name[0] || "") + "*" : name.slice(0, 2) + "***";
  return safeName + "@" + domain;
};

export const getGooglePromptFeedback = (reason: string): AuthStatus => {
  if (!reason) return null;
  const normalized = String(reason).toLowerCase();

  if (/cookie|storage/i.test(normalized)) {
    return {
      type: "google-cookies",
      message:
        "ورود با گوگل به‌دلیل تنظیمات کوکی مرورگر شما مسدود شده است. کوکی‌های شخص ثالث را فعال کنید یا به accounts.google.com اجازه دسترسی بدهید و دوباره تلاش کنید.",
    };
  }

  if (normalized.includes("browser_not_supported")) {
    return {
      type: "error",
      message:
        "ورود با گوگل در این مرورگر پشتیبانی نمی‌شود. از مرورگرهای به‌روز مانند Chrome یا Edge استفاده کنید.",
    };
  }

  if (normalized.includes("secure_http_required")) {
    return {
      type: "error",
      message:
        "ورود با گوگل نیازمند اتصال امن (HTTPS) است. لطفاً از نسخهٔ امن سایت استفاده کنید.",
    };
  }

  if (
    normalized.includes("invalid_client") ||
    normalized.includes("unregistered_origin")
  ) {
    return {
      type: "error",
      message:
        "ورود با گوگل برای این سایت پیکربندی نشده است. لطفاً با پشتیبانی تماس بگیرید.",
    };
  }

  if (
    normalized.includes("opt_out_or_no_session") ||
    normalized.includes("no_session")
  ) {
    return {
      type: "info",
      message:
        "هیچ نشست فعالی از گوگل یافت نشد. ابتدا وارد حساب گوگل خود شوید و سپس دوباره تلاش کنید.",
    };
  }

  if (normalized.includes("suppressed_by_user")) {
    return {
      type: "info",
      message:
        "ورود با گوگل توسط شما لغو شد. می‌توانید با ایمیل ادامه دهید یا بعداً دوباره تلاش کنید.",
    };
  }

  if (normalized.includes("issuing_failed")) {
    return {
      type: "error",
      message: "فرآیند ورود با گوگل تکمیل نشد. لطفاً دوباره تلاش کنید.",
    };
  }

  if (
    normalized.includes("credential_returned") ||
    normalized.includes("user_cancel") ||
    normalized.includes("tap_outside") ||
    normalized.includes("auto_cancel") ||
    normalized.includes("cancel")
  ) {
    return null;
  }

  return {
    type: "error",
    message:
      "در حال حاضر امکان ورود با گوگل وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.",
  };
};
