import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Seo from "../../../components/Seo";
import { identityApi } from "../api/identityApi.ts";
import {
  identityErrorCode,
  identityErrorMessage,
  identityFieldErrors,
  retryAfterSeconds,
} from "../api/identityErrors.ts";
import {
  emailSchema,
  loginSchema,
  registerPasswordSchema,
  registerSchema,
  verificationSchema,
} from "../model/authSchemas.ts";
import { normalizeDigits } from "../../../shared/forms/numbers.ts";
import { createZodResolver } from "../../../shared/forms/zodResolver.ts";

function isEmailValid(value) {
  return emailSchema.safeParse(value).success;
}

function getPasswordStrength(value) {
  if (!value) {
    return { score: 0, label: "Weak" };
  }
  const length = value.length;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const variety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean)
    .length;

  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (variety >= 2) score += 1;
  if (variety >= 3) score += 1;

  const label =
    score >= 4 ? "قوی" : score === 3 ? "خوب" : score === 2 ? "متوسط" : "ضعیف";
  return { score, label };
}

function getPasswordPolicyError(value) {
  const result = registerPasswordSchema.safeParse(value);
  return result.success ? "" : result.error.issues[0]?.message || "رمز عبور معتبر نیست.";
}

function getResendSeconds(payload, fallbackSeconds) {
  if (!payload || typeof payload !== "object") return fallbackSeconds;
  const seconds =
    payload.retry_after_seconds ?? payload.resend_seconds ?? fallbackSeconds;
  if (!Number.isFinite(seconds)) return fallbackSeconds;
  return Math.max(0, Math.floor(seconds));
}

function getOtpExpirySeconds(payload, fallbackSeconds) {
  if (!payload || typeof payload !== "object") return fallbackSeconds;
  const seconds = payload.code_expires_in_seconds ?? fallbackSeconds;
  if (!Number.isFinite(seconds)) return fallbackSeconds;
  return Math.max(0, Math.floor(seconds));
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const GOOGLE_COOKIE_HELP_URL =
  "https://support.google.com/accounts/answer/61416?hl=en";

function getCookieSettingsUrl() {
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
}

function getGooglePromptReason(notification) {
  if (!notification) return "";
  if (!notification.getMomentType) return "";
  const momentType = notification.getMomentType();
  if (momentType === "skipped") {
    return notification.getSkippedReason?.() || "";
  }
  if (momentType === "dismissed") {
    return notification.getDismissedReason?.() || "";
  }
  return "";
}

function isCookieBlockedReason(reason) {
  if (!reason) return false;
  return /cookie|storage/i.test(reason);
}

function getGooglePromptFeedback(reason) {
  if (!reason) return null;
  const normalized = String(reason).toLowerCase();
  if (isCookieBlockedReason(normalized)) {
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
      message:
        "فرآیند ورود با گوگل تکمیل نشد. لطفاً دوباره تلاش کنید.",
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
}
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.6c-.2 1.4-1.6 4.1-5.6 4.1-3.4 0-6.1-2.8-6.1-6.2S8.6 5.8 12 5.8c2 0 3.3.8 4.1 1.5l2.8-2.7C17.4 3.2 15 2 12 2 6.9 2 2.8 6.1 2.8 12S6.9 22 12 22c7 0 8.7-4.9 8.7-7.4 0-.5-.1-1-.1-1.4H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.1l3.1 2.3C7.8 7.5 9.7 5.8 12 5.8c2 0 3.3.8 4.1 1.5l2.8-2.7C17.4 3.2 15 2 12 2 8.1 2 4.7 4.2 3.9 7.1z"
      />
      <path
        fill="#FBBC05"
        d="M12 22c3 0 5.6-1 7.4-2.8l-3.4-2.6c-.9.6-2.1 1-4 1-3.4 0-6.2-2.8-6.2-6.2 0-.7.1-1.3.3-1.9l-3.2-2.5C2.4 8.2 2 10.1 2 12c0 5.9 4.8 10 10 10z"
      />
      <path
        fill="#4285F4"
        d="M20.7 12.2c0-.5-.1-1-.1-1.4H12v3.9h5.6c-.3 1.4-1.6 4.1-5.6 4.1v3.2c3.2 0 7.7-2.1 8.7-6.8z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m3 8 9 6 9-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 19a8 8 0 0 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {!open && (
        <path
          d="M4 4l16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

function Cloud({ className }) {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true" className={className}>
      <path
        d="M62 94h65a33 33 0 0 0 3-66 40 40 0 0 0-78 11A29 29 0 0 0 62 94Z"
        fill="#D6E8FF"
      />
    </svg>
  );
}

function ArcticStar({ className }) {
  return (
    <div
      aria-hidden="true"
      className={`${className} flex items-center justify-center text-[64px]`}
    >
      ❄️
    </div>
  );
}

function Wand({ className }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <rect
        x="12"
        y="74"
        width="90"
        height="12"
        rx="6"
        transform="rotate(-35 12 74)"
        fill="#6D6BC7"
      />
      <rect
        x="16"
        y="68"
        width="90"
        height="8"
        rx="4"
        transform="rotate(-35 16 68)"
        fill="#F7B731"
      />
      <path
        d="M96 18l6 12 12 6-12 6-6 12-6-12-12-6 12-6 6-12Z"
        fill="#FFC857"
      />
      <circle cx="76" cy="30" r="4" fill="#FFC857" />
      <circle cx="110" cy="54" r="4" fill="#FFC857" />
    </svg>
  );
}


export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const queryMode = params.get("mode");
    if (queryMode === "signup" || queryMode === "login") return queryMode;
    if (location.pathname === "/signup") return "signup";
    if (location.pathname === "/login") return "login";
    return "login";
  }, [location.pathname, location.search]);
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const DEFAULT_OTP_TTL_SECONDS = 600;
  const PASSWORD_PROMPT_FLAG = "auth.promptSetPassword";
  const cookieSettingsUrl = useMemo(() => getCookieSettingsUrl(), []);
  const cookieSettingsLabel = cookieSettingsUrl
    ? "باز کردن تنظیمات کوکی"
    : "راهنمای کوکی‌ها";

  const isSignup = mode === "signup";
  const isVerify = mode === "verify";
  const activeSchema = isVerify
    ? verificationSchema
    : isSignup
      ? registerSchema
      : loginSchema;
  const {
    register,
    handleSubmit: handleFormSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    setFocus,
    trigger,
    getValues,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm({
    resolver: createZodResolver(activeSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      verificationCode: "",
      fullName: "",
    },
  });
  const email = watch("email") || "";
  const password = watch("password") || "";
  const verificationCode = watch("verificationCode") || "";
  const fullName = watch("fullName") || "";
  const submitting = actionSubmitting || formSubmitting;

  const submitLabel = isVerify
    ? "تأیید"
    : isSignup
      ? "ثبت‌نام"
      : "ورود";
  const seoTitle = isVerify
    ? "تایید ایمیل | پرو اسلایدز"
    : isSignup
      ? "ثبت‌نام در پرو اسلایدز | شروع ارائه‌های تعاملی"
      : "ورود به پرو اسلایدز | مدیریت ارائه‌های تعاملی";
  const seoDescription =
    "ورود یا ثبت‌نام در پرو اسلایدز برای ساخت و مدیریت ارائه‌های تعاملی با نظرسنجی زنده و کوییز.";
  const seoCanonical = `https://proslides.ir/${isSignup ? "signup" : "login"}`;

  const trimmedEmail = email.trim();
  const emailError = errors.email?.message || "";
  const passwordPolicyError = isSignup ? errors.password?.message || "" : "";
  const fullNameError = isSignup ? errors.fullName?.message || "" : "";
  const verificationCodeError = isVerify
    ? errors.verificationCode?.message || ""
    : "";
  const passwordStrength = useMemo(
    () => getPasswordStrength(password.trim()),
    [password]
  );

  const otpExpired = isVerify && otpExpiresIn === 0;

  const isReady = useMemo(() => {
    if (isVerify) {
      return verificationSchema.safeParse({
        email: trimmedEmail,
        verificationCode,
      }).success;
    }
    if (isSignup) {
      return registerSchema.safeParse({
        email: trimmedEmail,
        password,
        fullName,
      }).success;
    }
    return loginSchema.safeParse({
      email: trimmedEmail,
      password,
    }).success;
  }, [
    trimmedEmail,
    password,
    isSignup,
    isVerify,
    verificationCode,
    fullName,
  ]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleModeSwitch = () => {
    if (mode === "verify") {
      setMode("login");
      navigate("/login", { replace: true });
    } else {
      const nextMode = mode === "login" ? "signup" : "login";
      setMode(nextMode);
      navigate(`/${nextMode}`, { replace: true });
    }
    setStatus(null);
    clearErrors();
    setResendCooldown(0);
    setOtpExpiresIn(0);
    setValue("password", "");
    setValue("verificationCode", "");
  };

  const handleEditEmail = () => {
    setMode("login");
    setStatus(null);
    clearErrors();
    setResendCooldown(0);
    setOtpExpiresIn(0);
    setValue("verificationCode", "");
  };

  const maskEmail = (value) => {
    const trimmed = value.trim();
    if (!trimmed.includes("@")) return trimmed;
    const [name, domain] = trimmed.split("@");
    if (!name || !domain) return trimmed;
    const safeName =
      name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`;
    return `${safeName}@${domain}`;
  };

  useEffect(() => {
    if (!resendCooldown) return;
    const timeout = setTimeout(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [resendCooldown]);

  useEffect(() => {
    if (!otpExpiresIn) return;
    const timeout = setTimeout(() => {
      setOtpExpiresIn((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [otpExpiresIn]);

  useEffect(() => {
    if (!resendCooldown) {
      localStorage.removeItem("auth.resendCooldown");
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (!otpExpiresIn) {
      localStorage.removeItem("auth.otpExpiry");
    }
  }, [otpExpiresIn]);

  useEffect(() => {
    if (!isVerify || !trimmedEmail) return;
    const raw = localStorage.getItem("auth.resendCooldown");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.email || parsed.email !== trimmedEmail) return;
      const remainingMs = parsed.expiresAt - Date.now();
      if (remainingMs <= 0) return;
      setResendCooldown(Math.ceil(remainingMs / 1000));
    } catch {
      localStorage.removeItem("auth.resendCooldown");
    }
  }, [isVerify, trimmedEmail]);

  useEffect(() => {
    if (!isVerify || !trimmedEmail) return;
    const raw = localStorage.getItem("auth.otpExpiry");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.email || parsed.email !== trimmedEmail) return;
      const remainingMs = parsed.expiresAt - Date.now();
      if (remainingMs <= 0) {
        setOtpExpiresIn(0);
        return;
      }
      setOtpExpiresIn(Math.ceil(remainingMs / 1000));
    } catch {
      localStorage.removeItem("auth.otpExpiry");
    }
  }, [isVerify, trimmedEmail]);

  useEffect(() => {
    if (!isVerify || otpExpiresIn > 0 || !trimmedEmail) return;
    if (!localStorage.getItem("auth.otpExpiry")) {
      setOtpExpiresIn(DEFAULT_OTP_TTL_SECONDS);
    }
  }, [isVerify, otpExpiresIn, trimmedEmail]);

  const startResendCooldown = (seconds) => {
    const safeSeconds = Math.max(0, seconds || 0);
    setResendCooldown(safeSeconds);
    if (!safeSeconds || !trimmedEmail) return;
    localStorage.setItem(
      "auth.resendCooldown",
      JSON.stringify({
        email: trimmedEmail,
        expiresAt: Date.now() + safeSeconds * 1000,
      })
    );
  };

  const startOtpExpiry = (seconds) => {
    const safeSeconds = Math.max(0, seconds || 0);
    setOtpExpiresIn(safeSeconds);
    if (!safeSeconds || !trimmedEmail) return;
    localStorage.setItem(
      "auth.otpExpiry",
      JSON.stringify({
        email: trimmedEmail,
        expiresAt: Date.now() + safeSeconds * 1000,
      })
    );
  };

  const setAuthEmail = (value) => {
    if (!value) return;
    localStorage.setItem("auth.email", value);
  };

  const flagPasswordPrompt = () => {
    localStorage.setItem(PASSWORD_PROMPT_FLAG, "1");
  };

  const handleOpenCookieSettings = () => {
    const targetUrl = cookieSettingsUrl || GOOGLE_COOKIE_HELP_URL;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenCookieHelp = () => {
    window.open(GOOGLE_COOKIE_HELP_URL, "_blank", "noopener,noreferrer");
  };

  const handleGooglePromptMoment = (notification) => {
    const reason = getGooglePromptReason(notification);
    const feedback = getGooglePromptFeedback(reason);
    if (!feedback) return;
    setStatus(feedback);
  };

  const navigateToDashboard = useCallback(() => {
    navigate("/manager/panel");
  }, [navigate]);

  const applyServerFieldErrors = useCallback((error) => {
    const fieldErrors = identityFieldErrors(error);
    const entries = [
      ["email", fieldErrors.email],
      ["password", fieldErrors.password],
      ["fullName", fieldErrors.full_name],
      ["verificationCode", fieldErrors.code],
    ].filter(([, message]) => Boolean(message));

    for (const [field, message] of entries) {
      setError(field, { type: "server", message });
    }
    if (entries[0]) setFocus(entries[0][0]);
  }, [setError, setFocus]);

  const handleGoogleResponse = useCallback(
    async (response) => {
      if (!response?.credential) {
        setStatus({
          type: "error",
          message: "ورود با گوگل توکن معتبری برنگرداند.",
        });
        return;
      }

      setActionSubmitting(true);
      setStatus(null);
      try {
        const payload = await identityApi.authenticateWithGoogle({
          token: response.credential,
        });

        const resolvedName =
          payload?.display_name || payload?.full_name || payload?.name;
        if (resolvedName) localStorage.setItem("auth.name", resolvedName);
        if (payload?.email) {
          setAuthEmail(payload.email);
        }
        if (payload?.needs_password_setup || payload?.is_new_user) {
          flagPasswordPrompt();
        }

        navigateToDashboard();
      } catch (error) {
        applyServerFieldErrors(error);
        setStatus({
          type: "error",
          message: identityErrorMessage(error, "ورود با گوگل ناموفق بود."),
        });
      } finally {
        setActionSubmitting(false);
      }
    },
    [applyServerFieldErrors, navigateToDashboard]
  );

  useEffect(() => {
    if (!googleClientId) return;
    const scriptId = "google-identity";
    const shouldUseFedcm =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      !["localhost", "127.0.0.1"].includes(window.location.hostname);
    const initialize = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleResponse,
        ux_mode: "popup",
        use_fedcm_for_prompt: shouldUseFedcm,
      });
      setGoogleReady(true);
    };

    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      if (window.google?.accounts?.id) {
        initialize();
      } else {
        existingScript.addEventListener("load", initialize, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => {
      setStatus({
        type: "error",
        message: "در حال حاضر امکان بارگذاری ورود با گوگل وجود ندارد.",
      });
    };
    document.body.appendChild(script);
  }, [googleClientId, handleGoogleResponse]);

  const handleGoogleSignIn = () => {
    if (!googleClientId) {
      setStatus({
        type: "error",
        message: "ورود با گوگل برای این سایت پیکربندی نشده است.",
      });
      return;
    }
    if (!googleReady || !window.google?.accounts?.id) {
      setStatus({
        type: "error",
        message: "ورود با گوگل هنوز در حال بارگذاری است. لطفاً دوباره تلاش کنید.",
      });
      return;
    }
    setStatus(null);
    if (typeof navigator !== "undefined" && navigator.cookieEnabled === false) {
      setStatus({
        type: "google-cookies",
        message:
          "ورود با گوگل هنوز در حال بارگذاری است. لطفاً دوباره تلاش کنید.",
      });
      return;
    }
    window.google.accounts.id.prompt(handleGooglePromptMoment);
  };

  const handleLogin = async (values) => {
    let payload;
    try {
      payload = await identityApi.login({
        email: values.email.trim(),
        password: values.password,
      });
    } catch (error) {
      applyServerFieldErrors(error);
      if (identityErrorCode(error) === "email_not_verified") {
        setMode("verify");
        setStatus({
          type: "info",
          message:
            "حساب کاربری هنوز تأیید نشده است. کد ارسال‌شده به ایمیل خود را بررسی کنید یا دوباره ارسال نمایید.",
        });
        if (!otpExpiresIn) {
          startOtpExpiry(DEFAULT_OTP_TTL_SECONDS);
        }
        return;
      }
      throw error;
    }

    setAuthEmail(values.email.trim());
    const resolvedName = payload?.display_name || getValues("fullName").trim();
    if (resolvedName) {
      localStorage.setItem("auth.name", resolvedName);
    }

    navigateToDashboard();
  };

  const handleForgotPassword = async () => {
    const currentEmail = getValues("email").trim();
    if (!currentEmail) {
      setStatus({
        type: "error",
        message: "برای بازیابی رمز عبور، ابتدا ایمیل خود را وارد کنید.",
      });
      return;
    }

    setActionSubmitting(true);
    setStatus(null);
    try {
      await identityApi.requestPasswordReset({ email: currentEmail });
      setStatus({
        type: "info",
        message: "راهنمای بازیابی رمز عبور به ایمیل شما ارسال شد.",
      });
    } catch (error) {
      applyServerFieldErrors(error);
      setStatus({
        type: "error",
        message: identityErrorMessage(
          error,
          "امکان ارسال راهنمای بازیابی وجود ندارد.",
        ),
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleSignup = async (values) => {
    const trimmedName = values.fullName.trim();
    let responsePayload;
    try {
      responsePayload = await identityApi.register({
        email: values.email.trim(),
        password: values.password,
        display_name: trimmedName,
      });
    } catch (error) {
      applyServerFieldErrors(error);
      if (identityErrorCode(error) === "email_taken") {
        setStatus({
          type: "email-exists",
          message:
            "این ایمیل قبلاً ثبت شده است. می‌توانید وارد شوید یا در صورت نیاز رمز عبور خود را بازیابی کنید.",
        });
        return;
      }
      throw error;
    }

    if (trimmedName) {
      localStorage.setItem("auth.name", trimmedName);
    }
    setAuthEmail(values.email.trim());

    if (responsePayload?.is_active) {
      navigateToDashboard();
      return;
    }

    setStatus({
      type: "info",
      message: `کد ۶ رقمی به ${maskEmail(values.email)} ارسال شد. برای تأیید حساب آن را وارد کنید.`,
    });
    setMode("verify");
    setValue("verificationCode", "");
    clearErrors();
    startResendCooldown(getResendSeconds(responsePayload, 60));
    startOtpExpiry(
      getOtpExpirySeconds(responsePayload, DEFAULT_OTP_TTL_SECONDS)
    );
  };

  const handleVerify = async (values) => {
    setStatus(null);
    try {
      await identityApi.verifyEmail({
        email: values.email.trim(),
        code: values.verificationCode,
      });

      setAuthEmail(values.email.trim());
      navigateToDashboard();
    } catch (error) {
      applyServerFieldErrors(error);
      if (identityErrorCode(error) === "verification_expired") {
        setOtpExpiresIn(0);
      }
      setStatus({
        type:
          identityErrorCode(error) === "verification_expired"
            ? "otp-expired"
            : "error",
        message: identityErrorMessage(error, "امکان تأیید ایمیل وجود ندارد."),
      });
    }
  };

  const handleResendVerification = async () => {
    const currentEmail = getValues("email").trim();
    if (!currentEmail) {
      setStatus({
        type: "error",
        message: "برای ارسال مجدد کد، ایمیل خود را وارد کنید.",
      });
      return;
    }

    setActionSubmitting(true);
    setStatus(null);
    try {
      const payload = await identityApi.resendVerification({
        email: currentEmail,
      });
      setStatus({
        type: "info",
        message: "کد تأیید ارسال شد.",
      });
      startResendCooldown(getResendSeconds(payload, 60));
      startOtpExpiry(getOtpExpirySeconds(payload, DEFAULT_OTP_TTL_SECONDS));
      setValue("verificationCode", "");
    } catch (error) {
      const retrySeconds = retryAfterSeconds(error, resendCooldown);
      if (retrySeconds > 0) setResendCooldown(retrySeconds);
      applyServerFieldErrors(error);
      setStatus({
        type: "error",
        message: identityErrorMessage(
          error,
          "امکان ارسال مجدد کد وجود ندارد.",
        ),
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  const submitForm = handleFormSubmit(async (values) => {
    setStatus(null);
    clearErrors();

    try {
      if (isVerify) {
        await handleVerify(values);
      } else if (isSignup) {
        await handleSignup(values);
      } else {
        await handleLogin(values);
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: identityErrorMessage(error),
      });
    }
  });

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-8 pt-8 sm:px-5 sm:pb-10 sm:pt-14 md:pb-[70px] md:pt-[120px]"
      style={{
        fontFamily: '"Vazirmatn", "Outfit", "Segoe UI", sans-serif',
        background:
          "radial-gradient(circle at 15% 20%, #ffffff 0%, #f3f8ff 45%, transparent 65%), radial-gradient(circle at 90% 15%, #eef5ff 0%, transparent 55%), radial-gradient(circle at 80% 90%, #e8f2ff 0%, transparent 55%), linear-gradient(180deg, #f8fbff 0%, #f1f6ff 100%)",
      }}
    >
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonical={seoCanonical}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage: "radial-gradient(#dce6f4 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="absolute left-0 right-0 top-6 z-10 px-6 md:px-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="hidden md:block" />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[#1b2430] font-semibold text-lg before:content-['✱'] before:text-xl"
          >
            ProSlides
          </Link>
          <div className="flex justify-end" />
        </div>
      </div>

      {!isVerify && (
        <div className="pointer-events-none absolute inset-0 z-[1] hidden md:block">
          <Cloud className="absolute left-[10%] top-[22%] w-[200px] opacity-90 animate-[auth-float_6s_ease-in-out_infinite]" />
          <Cloud
            className="absolute bottom-[18%] right-[8%] w-[200px] opacity-90 animate-[auth-float_6s_ease-in-out_infinite]"
            style={{ animationDelay: "1.2s" }}
          />
          <ArcticStar
            className="absolute bottom-[18%] left-[16%] w-[140px] animate-[auth-float_7s_ease-in-out_infinite]"
            style={{ animationDelay: "0.4s" }}
          />
          <Wand
            className="absolute right-[18%] top-[30%] w-[140px] animate-[auth-float_5s_ease-in-out_infinite]"
            style={{ animationDelay: "0.8s" }}
          />
        </div>
      )}

      <div className="relative z-[2] w-[min(92vw,430px)] max-h-[78vh] overflow-y-auto animate-[auth-card-in_0.6s_ease-out_both] rounded-[28px] bg-white px-6 pb-7 pt-8 text-center shadow-[0_28px_60px_rgba(15,23,42,0.14)] sm:max-h-none sm:overflow-visible sm:px-8 sm:pb-8 sm:pt-9 md:px-6 md:pt-8">
        <h1 className="text-[28px] font-semibold leading-tight text-[#1f2937]">
          {isVerify ? "تأیید ایمیل" : isSignup ? "ثبت‌نام" : "ورود"}
        </h1>
        {isVerify && trimmedEmail && (
          <div className="mt-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-left text-xs text-[#475569]">
            <div>کد به {maskEmail(trimmedEmail)} ارسال شد.</div>
            <div className="mt-1">
              {otpExpired
                ? "کد منقضی شده است. یک کد جدید درخواست کنید یا همین کد را امتحان کنید."
                : `انقضا تا ${formatCountdown(otpExpiresIn)}`}
            </div>
            {otpExpired && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={submitting || resendCooldown > 0}
                className="mt-2 inline-flex items-center rounded-md border border-[#c4b5fd] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4c1d95] hover:bg-[#f5f3ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendCooldown > 0
                  ? `ارسال مجدد تا 0:${String(resendCooldown).padStart(2, "0")}`
                  : "ارسال مجدد کد"}
              </button>
            )}
          </div>
        )}
        <p
          className={`mt-1 flex items-center justify-center gap-1.5 text-sm text-[#6b7280] ${
            !isVerify && !isSignup ? "flex-row-reverse" : ""
          }`}
        >
          {isVerify
            ? "کد جدید می‌خواهید؟"
            : isSignup
              ? "یا"
              : "حساب کاربری ندارید؟"}
          <button
            type="button"
            onClick={isVerify ? handleResendVerification : handleModeSwitch}
            disabled={isVerify && (submitting || resendCooldown > 0)}
            className="font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer disabled:cursor-not-allowed disabled:text-[#9ca3af] disabled:no-underline"
          >
            {isVerify
              ? resendCooldown > 0
                ? `ارسال مجدد تا 0:${String(resendCooldown).padStart(2, "0")}`
                : "ارسال مجدد کد"
              : isSignup
                ? "ورود به حساب کاربری"
                : "همین حالا ثبت‌نام کنید"}
          </button>
          {isVerify && (
            <button
              type="button"
              onClick={handleEditEmail}
              className="ml-2 font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer"
            >
              ویرایش ایمیل
            </button>
          )}
        </p>

        {!isVerify && (
          <div className="mt-4 flex flex-col gap-3 sm:gap-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:border-[#d1d5db] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {isSignup ? "ثبت‌نام با گوگل" : "ورود با گوگل"}
            </button>
          </div>
        )}

        {!isVerify && (
          <div className="my-4 flex items-center gap-3 text-xs tracking-[0.2em] text-[#9ca3af] sm:my-3">
            <span className="h-px flex-1 bg-[#e5e7eb]" />
            یا
            <span className="h-px flex-1 bg-[#e5e7eb]" />
          </div>
        )}

        <form className="flex flex-col" onSubmit={submitForm}>
          <label
            className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white sm:mb-2 ${fieldErrors.email ? "border-[#fca5a5]" : "border-[#e5e7eb]"
              }`}
          >
            <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
              <MailIcon />
            </span>
            <input
              className={`flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-black placeholder:opacity-100 ${isVerify ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                }`}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="ایمیل شما"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }
              }}
              disabled={isVerify}
              required
              aria-invalid={Boolean(emailError)}
              ref={emailRef}
            />
          </label>
          {emailError && (
            <div className="mb-3 text-left text-xs text-[#b91c1c] sm:mb-2">
              {emailError}
            </div>
          )}

          {!isVerify && (
            <label
              className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white sm:mb-2 ${fieldErrors.password ? "border-[#fca5a5]" : "border-[#e5e7eb]"
                }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-black placeholder:opacity-100"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="رمز عبور"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }
                }}
                required
                aria-invalid={Boolean(fieldErrors.password || passwordPolicyError)}
                ref={passwordRef}
              />
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center text-[#6b7280]"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </label>
          )}
          {!isVerify && fieldErrors.password && (
            <div className="mb-3 text-left text-xs text-[#b91c1c] sm:mb-2">
              {fieldErrors.password}
            </div>
          )}
          {!isVerify && isSignup && !fieldErrors.password && passwordPolicyError && (
            <div className="mb-3 text-left text-xs text-[#b91c1c] sm:mb-2">
              {passwordPolicyError}
            </div>
          )}
          {!isVerify && isSignup && password.trim() && (
            <div className="mb-3 text-left text-xs text-[#6b7280] sm:mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#374151]">قدرت رمز عبور:</span>
                <span className="text-[#6b7280]">{passwordStrength.label}</span>
              </div>
              <div className="mt-2 flex gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${passwordStrength.score > index
                      ? "bg-[#6c4cf5]"
                      : "bg-[#e5e7eb]"
                      }`}
                  />
                ))}
              </div>
              <div className="mt-2">
                حداقل ۸ کاراکتر استفاده کنید. از رمز عبوری که فقط عدد باشد خودداری کنید.
              </div>
            </div>
          )}

          {isVerify ? (
            <label
              className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white sm:mb-2 ${fieldErrors.code ? "border-[#fca5a5]" : "border-[#e5e7eb]"
                }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-black placeholder:opacity-100"
                type="text"
                inputMode="numeric"
                name="verification-code"
                placeholder="کد تأیید"
                maxLength={6}
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(
                    normalizeDigits(event.target.value).replace(/\D/g, "").slice(0, 6),
                  )
                }
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData("text") || "";
                  const cleaned = normalizeDigits(pasted).replace(/\D/g, "").slice(0, 6);
                  if (cleaned) {
                    event.preventDefault();
                    setVerificationCode(cleaned);
                  }
                }}
                autoComplete="one-time-code"
                required
                aria-invalid={Boolean(fieldErrors.code)}
                ref={codeRef}
              />
            </label>
          ) : isSignup ? (
            <label
              className={`mb-1 flex items-center overflow-hidden rounded-xl border bg-white ${fullNameError ? "border-[#fca5a5]" : "border-[#e5e7eb]"
                }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <UserIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-black placeholder:opacity-100"
                type="text"
                name="full-name"
                autoComplete="name"
                placeholder="نام و نام خانوادگی"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  if (fieldErrors.full_name) {
                    setFieldErrors((prev) => ({ ...prev, full_name: "" }));
                  }
                }}
                required
                aria-invalid={Boolean(fullNameError)}
              />
            </label>
          ) : (
            <div className="mb-3 flex justify-start sm:mb-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-[#9ca3af] transition hover:text-[#6b7280] hover:underline cursor-pointer"
              >
                رمز عبور را فراموش کرده اید؟
              </button>
            </div>
          )}
          {isSignup && fullNameError && (
            <div className="mb-3 text-left text-xs text-[#b91c1c] sm:mb-2">
              {fullNameError}
            </div>
          )}

          {status && (
            <div
              className={`mb-3 rounded-xl px-3 py-2 text-left text-xs sm:mb-2 ${status.type === "error"
                ? "bg-[#fee2e2] text-[#991b1b]"
                : status.type === "network" || status.type === "google-cookies"
                  ? "bg-[#fef9c3] text-[#92400e]"
                  : status.type === "email-exists"
                    ? "bg-[#ede9fe] text-[#4c1d95]"
                    : "bg-[#e0f2fe] text-[#0c4a6e]"
                }`}
              role={status.type === "error" ? "alert" : "status"}
              aria-live={status.type === "error" ? "assertive" : "polite"}
            >
              {status.message}
              {status.type === "network" && (
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={submitting}
                  className="ml-2 inline-flex items-center rounded-md border border-[#facc15] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef08a] disabled:cursor-not-allowed"
                >
                  تلاش مجدد
                </button>
              )}
              {status.type === "google-cookies" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenCookieSettings}
                    className="inline-flex items-center rounded-md border border-[#fcd34d] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef08a]"
                  >
                    {cookieSettingsLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="inline-flex items-center rounded-md border border-[#fcd34d] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef08a]"
                  >
                    تلاش مجدد با گوگل
                  </button>
                  {cookieSettingsUrl && (
                    <button
                      type="button"
                      onClick={handleOpenCookieHelp}
                      className="inline-flex items-center rounded-md border border-[#fcd34d] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef08a]"
                    >
                      راهنمای فعال‌سازی
                    </button>
                  )}
                </div>
              )}
              {status.type === "email-exists" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="inline-flex items-center rounded-md border border-[#c4b5fd] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4c1d95] hover:bg-[#f5f3ff]"
                  >
                    استفاده از گوگل
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="inline-flex items-center rounded-md border border-[#c4b5fd] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4c1d95] hover:bg-[#f5f3ff]"
                  >
                    تنظیم رمز عبور
                  </button>
                </div>
              )}
              {status.type === "otp-expired" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={submitting || resendCooldown > 0}
                    className="inline-flex items-center rounded-md border border-[#fcd34d] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef08a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendCooldown > 0
                      ? `ارسال مجدد تا 0:${String(resendCooldown).padStart(2, "0")}`
                      : "ارسال مجدد کد"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="rounded-xl bg-[#6c4cf5] py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-[#5b3fe7] disabled:cursor-not-allowed disabled:bg-[#eceef2] disabled:text-[#b5bbc7]"
            disabled={!isReady || submitting}
          >
            {submitting ? "در حال پردازش..." : submitLabel}
          </button>
        </form>

      </div>
    </div>
  );
}
