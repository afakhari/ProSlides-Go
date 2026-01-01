import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";

function formatError(payload) {
  if (!payload) return "Something went wrong. Please try again.";
  if (payload.email) {
    const message = Array.isArray(payload.email)
      ? payload.email.join(", ")
      : payload.email;
    if (message.toLowerCase().includes("already")) {
      return "Email already used";
    }
    return `email: ${message}`;
  }
  if (payload.detail) return payload.detail;
  const keys = Object.keys(payload);
  if (!keys.length) return "Something went wrong. Please try again.";
  const firstKey = keys[0];
  const value = payload[firstKey];
  if (Array.isArray(value)) return `${firstKey}: ${value.join(", ")}`;
  return `${firstKey}: ${value}`;
}

function normalizeErrorValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function extractFieldErrors(payload) {
  if (!payload || typeof payload !== "object") return {};
  const errors = {};
  if (payload.email) errors.email = normalizeErrorValue(payload.email);
  if (payload.username && !errors.email) {
    errors.email = normalizeErrorValue(payload.username);
  }
  if (payload.password) errors.password = normalizeErrorValue(payload.password);
  if (payload.full_name) errors.full_name = normalizeErrorValue(payload.full_name);
  if (payload.code) errors.code = normalizeErrorValue(payload.code);
  if (payload.detail) errors.form = normalizeErrorValue(payload.detail);
  return errors;
}

function isEmailValid(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    score >= 4 ? "Strong" : score === 3 ? "Good" : score === 2 ? "Fair" : "Weak";
  return { score, label };
}

function getPasswordPolicyError(value) {
  if (!value) return "Enter a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (/^\d+$/.test(value)) return "Password cannot be all numbers.";
  return "";
}

function isDuplicateEmailError(payload) {
  if (!payload || typeof payload !== "object") return false;
  const message = normalizeErrorValue(payload.email || payload.detail || "");
  return /already|exist|used/i.test(message);
}

function isOtpExpiredError(payload) {
  if (!payload || typeof payload !== "object") return false;
  const message = normalizeErrorValue(payload.detail || "");
  return /expired/i.test(message);
}

function isNetworkError(error) {
  const message = error?.message || "";
  return (
    error?.name === "TypeError" ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError")
  );
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

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
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
  if (notification.isNotDisplayed?.()) {
    return notification.getNotDisplayedReason?.() || "";
  }
  if (notification.isSkippedMoment?.()) {
    return notification.getSkippedReason?.() || "";
  }
  return "";
}

function isCookieBlockedReason(reason) {
  if (!reason) return false;
  return /cookie|storage/i.test(reason);
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

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="3" y="3" width="8" height="8" fill="#F25022" />
      <rect x="13" y="3" width="8" height="8" fill="#7FBA00" />
      <rect x="3" y="13" width="8" height="8" fill="#00A4EF" />
      <rect x="13" y="13" width="8" height="8" fill="#FFB900" />
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

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
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

function ChatBubble() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8M8 14h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const codeRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const DEFAULT_OTP_TTL_SECONDS = 600;
  const PASSWORD_PROMPT_FLAG = "auth.promptSetPassword";
  const cookieSettingsUrl = useMemo(() => getCookieSettingsUrl(), []);
  const cookieSettingsLabel = cookieSettingsUrl
    ? "Open cookie settings"
    : "Open cookie help";

  const isSignup = mode === "signup";
  const isVerify = mode === "verify";
  const submitLabel = isVerify ? "Verify" : isSignup ? "Sign Up" : "Log In";

  const trimmedEmail = email.trim();
  const emailFormatError = useMemo(() => {
    if (isVerify) return "";
    if (!trimmedEmail) return "";
    return isEmailValid(trimmedEmail) ? "" : "Enter a valid email.";
  }, [isVerify, trimmedEmail]);
  const emailError = fieldErrors.email || emailFormatError;

  const passwordPolicyError = useMemo(() => {
    if (!isSignup) return "";
    if (!password.trim()) return "";
    return getPasswordPolicyError(password.trim());
  }, [isSignup, password]);
  const passwordStrength = useMemo(
    () => getPasswordStrength(password.trim()),
    [password]
  );

  const fullNameError = useMemo(() => {
    if (!isSignup) return "";
    if (fieldErrors.full_name) return fieldErrors.full_name;
    if (!hasSubmitted) return "";
    if (!fullName.trim()) return "Enter your full name.";
    return "";
  }, [fieldErrors.full_name, fullName, hasSubmitted, isSignup]);

  const otpExpired = isVerify && otpExpiresIn === 0;

  const isReady = useMemo(() => {
    if (!trimmedEmail) return false;
    if (!isEmailValid(trimmedEmail)) return false;
    if (isVerify) {
      return verificationCode.trim().length === 6;
    }
    if (!password.trim()) return false;
    if (isSignup && getPasswordPolicyError(password.trim())) return false;
    if (isSignup && !fullName.trim()) return false;
    return true;
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
    } else {
      setMode((prev) => (prev === "login" ? "signup" : "login"));
    }
    setStatus(null);
    setFieldErrors({});
    setResendCooldown(0);
    setHasSubmitted(false);
    setOtpExpiresIn(0);
    setPassword("");
    setVerificationCode("");
  };

  const handleEditEmail = () => {
    setMode("login");
    setStatus(null);
    setFieldErrors({});
    setResendCooldown(0);
    setHasSubmitted(false);
    setOtpExpiresIn(0);
    setVerificationCode("");
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

  useEffect(() => {
    if (!hasSubmitted) return;
    if (emailError && emailRef.current) {
      emailRef.current.focus();
      return;
    }
    if ((fieldErrors.password || passwordPolicyError) && passwordRef.current) {
      passwordRef.current.focus();
      return;
    }
    if (fieldErrors.code && codeRef.current) {
      codeRef.current.focus();
    }
  }, [hasSubmitted, emailError, fieldErrors, passwordPolicyError]);

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
    if (!reason || !isCookieBlockedReason(reason)) return;
    setStatus({
      type: "google-cookies",
      message:
        "Google sign-in was blocked by your browser's cookie settings. Enable third-party cookies or allow accounts.google.com, then try again.",
    });
  };

  const navigateToDashboard = useCallback(() => {
    navigate("/manager/panel");
  }, [navigate]);

  const handleGoogleResponse = useCallback(
    async (response) => {
      if (!response?.credential) {
        setStatus({
          type: "error",
          message: "Google login did not return a credential.",
        });
        return;
      }

      setSubmitting(true);
      setStatus(null);
      try {
        const googleResponse = await apiFetch("/auth/google/", {
          method: "POST",
          auth: false,
          json: { token: response.credential },
        });
        const payload = await parseJson(googleResponse);
        if (!googleResponse.ok) {
          setFieldErrors(extractFieldErrors(payload));
          throw new Error(formatError(payload));
        }

        const { access, refresh } = payload || {};
        if (!access) {
          throw new Error("Google login succeeded, but no access token returned.");
        }

        localStorage.setItem("auth.access", access);
        if (refresh) localStorage.setItem("auth.refresh", refresh);
        const resolvedName = payload?.full_name || payload?.name;
        if (resolvedName) localStorage.setItem("auth.name", resolvedName);
        if (payload?.email) {
          setAuthEmail(payload.email);
        }
        if (payload?.needs_password_setup || payload?.is_new_user) {
          flagPasswordPrompt();
        }

        navigateToDashboard();
      } catch (error) {
        setStatus({
          type: "error",
          message: error.message || "Google login failed.",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [navigateToDashboard]
  );

  useEffect(() => {
    if (!googleClientId) return;
    const scriptId = "google-identity";
    const initialize = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleResponse,
        ux_mode: "popup",
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
        message: "Unable to load Google login right now.",
      });
    };
    document.body.appendChild(script);
  }, [googleClientId, handleGoogleResponse]);

  const handleGoogleSignIn = () => {
    if (!googleClientId) {
      setStatus({
        type: "error",
        message: "Google login is not configured.",
      });
      return;
    }
    if (!googleReady || !window.google?.accounts?.id) {
      setStatus({
        type: "error",
        message: "Google login is still loading. Please try again.",
      });
      return;
    }
    setStatus(null);
    if (typeof navigator !== "undefined" && navigator.cookieEnabled === false) {
      setStatus({
        type: "google-cookies",
        message:
          "Cookies are disabled in your browser. Enable cookies and try Google sign-in again.",
      });
      return;
    }
    window.google.accounts.id.prompt(handleGooglePromptMoment);
  };

  const handleLogin = async () => {
    const response = await apiFetch("/auth/token/", {
      method: "POST",
      auth: false,
      json: {
        username: email.trim(),
        password: password.trim(),
      },
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      const message = formatError(payload);
      setFieldErrors(extractFieldErrors(payload));
      if (message.toLowerCase().includes("no active account")) {
        setMode("verify");
        setStatus({
          type: "info",
          message:
            "Account not verified yet. Check your email for the code or resend it.",
        });
        if (!otpExpiresIn) {
          startOtpExpiry(DEFAULT_OTP_TTL_SECONDS);
        }
        return;
      }
      throw new Error(message);
    }

    const { access, refresh } = payload || {};
    if (!access) {
      throw new Error("Login succeeded, but no access token was returned.");
    }

    localStorage.setItem("auth.access", access);
    if (refresh) localStorage.setItem("auth.refresh", refresh);
    setAuthEmail(trimmedEmail);
    const resolvedName =
      payload?.full_name || payload?.name || fullName.trim();
    if (resolvedName) {
      localStorage.setItem("auth.name", resolvedName);
    }

    navigateToDashboard();
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setStatus({
        type: "error",
        message: "Enter your email first to reset your password.",
      });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const response = await apiFetch("/auth/password/reset/", {
        method: "POST",
        auth: false,
        json: { email: email.trim() },
      });
      const payload = await parseJson(response);
      if (!response.ok) {
        if (isOtpExpiredError(payload)) {
          setOtpExpiresIn(0);
          setStatus({
            type: "otp-expired",
            message:
              "That code has expired. Request a new code to continue.",
          });
          return;
        }
        setFieldErrors(extractFieldErrors(payload));
        throw new Error(formatError(payload));
      }
      setStatus({
        type: "info",
        message: "Password reset instructions sent. Check your inbox.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to send reset instructions.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async () => {
    const trimmedName = fullName.trim();
    const requestPayload = {
      username: email.trim(),
      email: email.trim(),
      password: password.trim(),
      full_name: trimmedName,
    };

    const response = await apiFetch("/auth/register/", {
      method: "POST",
      auth: false,
      json: requestPayload,
    });

    const responsePayload = await parseJson(response);
    if (!response.ok) {
      setHasSubmitted(true);
      setFieldErrors(extractFieldErrors(responsePayload));
      if (isDuplicateEmailError(responsePayload)) {
        setStatus({
          type: "email-exists",
          message:
            "This email is already registered. Use Google sign-in or set a password to log in.",
        });
        return;
      }
      throw new Error(formatError(responsePayload));
    }

    if (fullName.trim()) {
      localStorage.setItem("auth.name", fullName.trim());
    }
    setAuthEmail(trimmedEmail);

    if (responsePayload?.is_active) {
      await handleLogin();
      return;
    }

    setStatus({
      type: "info",
      message: `We sent a 6-digit code to ${maskEmail(email)}. Enter it to verify your account.`,
    });
    setMode("verify");
    startResendCooldown(getResendSeconds(responsePayload, 60));
    startOtpExpiry(
      getOtpExpirySeconds(responsePayload, DEFAULT_OTP_TTL_SECONDS)
    );
  };

  const handleVerify = async () => {
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await apiFetch("/auth/verify/", {
        method: "POST",
        auth: false,
        json: {
          email: email.trim(),
          code: verificationCode.trim(),
        },
      });

      const payload = await parseJson(response);
      if (!response.ok) {
        setFieldErrors(extractFieldErrors(payload));
        throw new Error(formatError(payload));
      }

      setStatus({
        type: "info",
        message: "Email verified. You can log in now.",
      });
      setMode("login");
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to verify email.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setStatus({
        type: "error",
        message: "Enter your email to resend the code.",
      });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const response = await apiFetch("/auth/verify/resend/", {
        method: "POST",
        auth: false,
        json: { email: email.trim() },
      });
      const payload = await parseJson(response);
      if (!response.ok) {
        setHasSubmitted(true);
        setResendCooldown(getResendSeconds(payload, resendCooldown));
        setFieldErrors(extractFieldErrors(payload));
        throw new Error(formatError(payload));
      }
      setStatus({
        type: "info",
        message: payload?.detail || "Verification code sent.",
      });
      startResendCooldown(getResendSeconds(payload, 60));
      startOtpExpiry(getOtpExpirySeconds(payload, DEFAULT_OTP_TTL_SECONDS));
      setVerificationCode("");
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to resend verification code.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitForm = async () => {
    if (!isReady) return;
    setSubmitting(true);
    setStatus(null);
    setHasSubmitted(true);
    setFieldErrors({});
    try {
      if (isVerify) {
        await handleVerify();
      } else if (isSignup) {
        await handleSignup();
      } else {
        await handleLogin();
      }
    } catch (error) {
      if (isNetworkError(error)) {
        setStatus({
          type: "network",
          message:
            "We couldn't reach the server. Check your connection and try again.",
        });
      } else {
        setStatus({
          type: "error",
          message: error.message || "Something went wrong. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    submitForm();
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-8 pt-8 sm:px-5 sm:pb-10 sm:pt-14 md:pb-[70px] md:pt-[120px]"
      style={{
        fontFamily: '"Outfit", "Segoe UI", sans-serif',
        background:
          "radial-gradient(circle at 15% 20%, #ffffff 0%, #f3f8ff 45%, transparent 65%), radial-gradient(circle at 90% 15%, #eef5ff 0%, transparent 55%), radial-gradient(circle at 80% 90%, #e8f2ff 0%, transparent 55%), linear-gradient(180deg, #f8fbff 0%, #f1f6ff 100%)",
      }}
    >
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
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#394152] shadow-[0_6px_16px_rgba(15,23,42,0.08)]"
            >
              <GlobeIcon />
              <span>EN</span>
            </button>
          </div>
        </div>
      </div>

      {!isSignup && (
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
        <h1 className="text-[26px] font-semibold text-[#1f2937]">
          {isVerify ? "Verify email" : isSignup ? "Sign up" : "Log in"}
        </h1>
        {isVerify && trimmedEmail && (
          <div className="mt-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-left text-xs text-[#475569]">
            <div>Code sent to {maskEmail(trimmedEmail)}.</div>
            <div className="mt-1">
              {otpExpired
                ? "Code expired. Request a new code or try the current one."
                : `Expires in ${formatCountdown(otpExpiresIn)}.`}
            </div>
            {otpExpired && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={submitting || resendCooldown > 0}
                className="mt-2 inline-flex items-center rounded-md border border-[#c4b5fd] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4c1d95] hover:bg-[#f5f3ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendCooldown > 0
                  ? `Resend in 0:${String(resendCooldown).padStart(2, "0")}`
                  : "Resend code"}
              </button>
            )}
          </div>
        )}
        <p className="mt-1 text-sm text-[#6b7280]">
          {isVerify ? "Need a new code? " : isSignup ? "Or " : "No account? "}
          <button
            type="button"
            onClick={isVerify ? handleResendVerification : handleModeSwitch}
            disabled={isVerify && (submitting || resendCooldown > 0)}
            className="font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer disabled:cursor-not-allowed disabled:text-[#9ca3af] disabled:no-underline"
          >
            {isVerify
              ? resendCooldown > 0
                ? `Resend in 0:${String(resendCooldown).padStart(2, "0")}`
                : "Resend code"
              : isSignup
                ? "Log in to your account"
                : "Sign up now"}
          </button>
          {isVerify && (
            <button
              type="button"
              onClick={handleEditEmail}
              className="ml-2 font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer"
            >
              Edit email
            </button>
          )}
        </p>

        {!isVerify && (
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:border-[#d1d5db] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {isSignup ? "Sign up with Google" : "Log in with Google"}
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:border-[#d1d5db] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
              disabled
            >
              <MicrosoftIcon />
              {isSignup ? "Sign up with Microsoft" : "Log in with Microsoft"}
              <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                Coming soon
              </span>
            </button>
          </div>
        )}

        {!isVerify && (
          <div className="my-4 flex items-center gap-3 text-xs tracking-[0.2em] text-[#9ca3af]">
            <span className="h-px flex-1 bg-[#e5e7eb]" />
            OR
            <span className="h-px flex-1 bg-[#e5e7eb]" />
          </div>
        )}

        <form className="flex flex-col" onSubmit={handleSubmit}>
          <label
            className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white ${fieldErrors.email ? "border-[#fca5a5]" : "border-[#e5e7eb]"
              }`}
          >
            <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
              <MailIcon />
            </span>
            <input
              className={`flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af] ${isVerify ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                }`}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Your email"
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
            <div className="mb-3 text-left text-xs text-[#b91c1c]">
              {emailError}
            </div>
          )}

          {!isVerify && (
            <label
              className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white ${fieldErrors.password ? "border-[#fca5a5]" : "border-[#e5e7eb]"
                }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="Your password"
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
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </label>
          )}
          {!isVerify && fieldErrors.password && (
            <div className="mb-3 text-left text-xs text-[#b91c1c]">
              {fieldErrors.password}
            </div>
          )}
          {!isVerify && isSignup && !fieldErrors.password && passwordPolicyError && (
            <div className="mb-3 text-left text-xs text-[#b91c1c]">
              {passwordPolicyError}
            </div>
          )}
          {!isVerify && isSignup && password.trim() && (
            <div className="mb-3 text-left text-xs text-[#6b7280]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#374151]">Strength:</span>
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
                Use at least 8 characters. Avoid passwords made of numbers
                only.
              </div>
            </div>
          )}

          {isVerify ? (
            <label
              className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white ${fieldErrors.code ? "border-[#fca5a5]" : "border-[#e5e7eb]"
                }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type="text"
                inputMode="numeric"
                name="verification-code"
                placeholder="Verification code"
                maxLength={6}
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, ""))
                }
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData("text") || "";
                  const cleaned = pasted.replace(/\D/g, "").slice(0, 6);
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
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type="text"
                name="full-name"
                autoComplete="name"
                placeholder="Your full name"
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
            <div className="mb-3 flex justify-start">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-[#9ca3af] transition hover:text-[#6b7280] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          )}
          {isSignup && fullNameError && (
            <div className="mb-3 text-left text-xs text-[#b91c1c]">
              {fullNameError}
            </div>
          )}

          {status && (
            <div
              className={`mb-3 rounded-xl px-3 py-2 text-left text-xs ${status.type === "error"
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
                  Try again
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
                    Try Google again
                  </button>
                  {cookieSettingsUrl && (
                    <button
                      type="button"
                      onClick={handleOpenCookieHelp}
                      className="inline-flex items-center rounded-md border border-[#fcd34d] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef08a]"
                    >
                      Learn how
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
                    Use Google
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="inline-flex items-center rounded-md border border-[#c4b5fd] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4c1d95] hover:bg-[#f5f3ff]"
                  >
                    Set password
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
                      ? `Resend in 0:${String(resendCooldown).padStart(2, "0")}`
                      : "Resend code"}
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
            {submitting ? "Working..." : submitLabel}
          </button>
        </form>

        {!isVerify && (
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer disabled:cursor-not-allowed disabled:text-[#9ca3af]"
            disabled
          >
            {isSignup ? "Sign up with SSO" : "Log in with SSO"}
            <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Coming soon
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
