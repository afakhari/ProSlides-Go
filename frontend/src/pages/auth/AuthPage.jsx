import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

async function parseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
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

function SparkLogo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7">
      <path
        d="M15.9 3.5c.5-1 1.9-1 2.4 0l2.2 4.2a6 6 0 0 0 2.5 2.5l4.2 2.2c1 .5 1 1.9 0 2.4l-4.2 2.2a6 6 0 0 0-2.5 2.5l-2.2 4.2c-.5 1-1.9 1-2.4 0l-2.2-4.2a6 6 0 0 0-2.5-2.5l-4.2-2.2c-1-.5-1-1.9 0-2.4l4.2-2.2a6 6 0 0 0 2.5-2.5l2.2-4.2Z"
        fill="url(#spark)"
      />
      <defs>
        <linearGradient id="spark" x1="2" y1="2" x2="30" y2="30">
          <stop offset="0" stopColor="#FF6FAE" />
          <stop offset="0.5" stopColor="#FF7B54" />
          <stop offset="1" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
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

function Palette({ className }) {
  return (
    <svg viewBox="0 0 140 140" aria-hidden="true" className={className}>
      <path
        d="M70 10c-33 0-60 24-60 54 0 29 26 54 56 54h9c9 0 13-12 6-19-5-5-4-13 2-17 7-5 16 1 16 9v1c0 14 11 26 25 26 18 0 26-16 26-34C150 43 116 10 70 10Z"
        fill="#FFE69C"
        stroke="#F4C45D"
        strokeWidth="4"
      />
      <circle cx="45" cy="55" r="8" fill="#FF6B6B" />
      <circle cx="73" cy="45" r="8" fill="#6BCB77" />
      <circle cx="55" cy="85" r="8" fill="#4D96FF" />
      <circle cx="86" cy="82" r="8" fill="#845EC2" />
    </svg>
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
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const isSignup = mode === "signup";
  const isVerify = mode === "verify";
  const submitLabel = isVerify ? "Verify" : isSignup ? "Sign Up" : "Log In";

  const isReady = useMemo(() => {
    if (!email.trim()) return false;
    if (isVerify) {
      return verificationCode.trim().length === 6;
    }
    if (!password.trim()) return false;
    if (isSignup && !fullName.trim()) return false;
    return true;
  }, [email, password, fullName, isSignup, isVerify, verificationCode]);

  const handleModeSwitch = () => {
    if (mode === "verify") {
      setMode("login");
    } else {
      setMode((prev) => (prev === "login" ? "signup" : "login"));
    }
    setStatus(null);
    setPassword("");
    setVerificationCode("");
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
          throw new Error(formatError(payload));
        }

        const { access, refresh, name } = payload || {};
        if (!access) {
          throw new Error("Google login succeeded, but no access token returned.");
        }

        localStorage.setItem("auth.access", access);
        if (refresh) localStorage.setItem("auth.refresh", refresh);
        if (name) localStorage.setItem("auth.name", name);

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
    window.google.accounts.id.prompt();
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
      if (message.toLowerCase().includes("no active account")) {
        setMode("verify");
        setStatus({
          type: "info",
          message: "Account not verified yet. Enter the verification code.",
        });
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
    if (fullName.trim()) {
      localStorage.setItem("auth.name", fullName.trim());
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
    const response = await apiFetch("/auth/register/", {
      method: "POST",
      auth: false,
      json: {
        username: email.trim(),
        email: email.trim(),
        password: password.trim(),
      },
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(formatError(payload));
    }

    if (fullName.trim()) {
      localStorage.setItem("auth.name", fullName.trim());
    }

    if (payload?.is_active) {
      await handleLogin();
      return;
    }

    setStatus({
      type: "info",
      message: "Enter the verification code from the terminal to continue.",
    });
    setMode("verify");
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
        throw new Error(formatError(payload));
      }
      setStatus({
        type: "info",
        message: payload?.detail || "Verification code sent.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to resend verification code.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReady) return;
    setSubmitting(true);
    setStatus(null);
    try {
      if (isVerify) {
        await handleVerify();
      } else if (isSignup) {
        await handleSignup();
      } else {
        await handleLogin();
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-[70px] pt-[120px]"
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

      <div className="absolute left-0 right-0 top-6 z-10 px-9 md:px-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="hidden md:block" />
          <div className="inline-flex items-center justify-center gap-2 text-[20px] font-semibold text-[#1b2430]">
            <SparkLogo />
            <span>ProSlides</span>
          </div>
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
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <Cloud className="absolute left-[10%] top-[22%] w-[200px] opacity-90 animate-[auth-float_6s_ease-in-out_infinite]" />
          <Cloud
            className="absolute bottom-[18%] right-[8%] w-[200px] opacity-90 animate-[auth-float_6s_ease-in-out_infinite]"
            style={{ animationDelay: "1.2s" }}
          />
          <Palette
            className="absolute bottom-[18%] left-[16%] w-[140px] animate-[auth-float_7s_ease-in-out_infinite]"
            style={{ animationDelay: "0.4s" }}
          />
          <Wand
            className="absolute right-[18%] top-[30%] w-[140px] animate-[auth-float_5s_ease-in-out_infinite]"
            style={{ animationDelay: "0.8s" }}
          />
        </div>
      )}

      <div className="relative z-[2] w-[min(92vw,430px)] animate-[auth-card-in_0.6s_ease-out_both] rounded-[28px] bg-white px-8 pb-8 pt-9 text-center shadow-[0_28px_60px_rgba(15,23,42,0.14)] md:px-6 md:pt-8">
        <h1 className="text-[26px] font-semibold text-[#1f2937]">
          {isVerify ? "Verify email" : isSignup ? "Sign up" : "Log in"}
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {isVerify ? "Need a new code? " : isSignup ? "Or " : "No account? "}
          <button
            type="button"
            onClick={isVerify ? handleResendVerification : handleModeSwitch}
            className="font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer"
          >
            {isVerify
              ? "Resend code"
              : isSignup
                ? "Log in to your account"
                : "Sign up now"}
          </button>
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
            >
              <MicrosoftIcon />
              {isSignup ? "Sign up with Microsoft" : "Log in with Microsoft"}
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
          <label className="mb-3 flex items-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
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
              onChange={(event) => setEmail(event.target.value)}
              disabled={isVerify}
              required
            />
          </label>

          {!isVerify && (
            <label className="mb-3 flex items-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
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
                onChange={(event) => setPassword(event.target.value)}
                required
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

          {isVerify ? (
            <label className="mb-3 flex items-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
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
                onChange={(event) => setVerificationCode(event.target.value)}
                required
              />
            </label>
          ) : isSignup ? (
            <label className="mb-1 flex items-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
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
                onChange={(event) => setFullName(event.target.value)}
                required
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

          {status && (
            <div
              className={`mb-3 rounded-xl px-3 py-2 text-left text-xs ${status.type === "error"
                  ? "bg-[#fee2e2] text-[#991b1b]"
                  : "bg-[#e0f2fe] text-[#0c4a6e]"
                }`}
            >
              {status.message}
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
            className="mt-4 text-sm font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline cursor-pointer"
          >
            {isSignup ? "Sign up with SSO" : "Log in with SSO"}
          </button>
        )}
      </div>

      <button
        type="button"
        className="absolute bottom-7 right-8 z-[2] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#6c4cf5] text-white shadow-[0_16px_30px_rgba(108,76,245,0.35)] md:bottom-5 md:right-5"
      >
        <ChatBubble />
      </button>
    </div>
  );
}
