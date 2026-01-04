import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";
import { apiFetch } from "../../utils/apiFetch";

function parseJson(response) {
  return response.json().catch(() => null);
}

function getPasswordPolicyError(value) {
  if (!value) return "Enter a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (/^\d+$/.test(value)) return "Password cannot be all numbers.";
  return "";
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

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const passwordPolicyError = useMemo(
    () => getPasswordPolicyError(password.trim()),
    [password]
  );
  const confirmError =
    confirmPassword && password !== confirmPassword
      ? "Passwords do not match."
      : "";
  const passwordStrength = useMemo(
    () => getPasswordStrength(password.trim()),
    [password]
  );

  const isReady =
    uid &&
    token &&
    password.trim() &&
    !passwordPolicyError &&
    confirmPassword.trim() &&
    !confirmError;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReady) return;
    setSubmitting(true);
    setStatus(null);

    try {
      const response = await apiFetch("/auth/password/reset/confirm/", {
        method: "POST",
        auth: false,
        json: { uid, token, new_password: password.trim() },
      });
      const payload = await parseJson(response);
      if (!response.ok) {
        const message = payload?.detail || "Unable to reset password.";
        throw new Error(message);
      }
      setStatus({
        type: "success",
        message: "Your password has been updated. You can log in now.",
      });
      setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to reset password.",
      });
    } finally {
      setSubmitting(false);
    }
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
      <Seo
        title="Reset password | ProSlides"
        description="Set a new password for your ProSlides account."
        canonical="https://proslides.ir/reset-password"
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

      <div className="relative z-[2] w-[min(92vw,430px)] animate-[auth-card-in_0.6s_ease-out_both] rounded-[28px] bg-white px-6 pb-7 pt-8 text-center shadow-[0_28px_60px_rgba(15,23,42,0.14)] sm:px-8 sm:pb-8 sm:pt-9 md:px-6 md:pt-8">
        <h1 className="text-[28px] font-semibold leading-tight text-[#1f2937]">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          Create a new password for your ProSlides account.
        </p>

        {!uid || !token ? (
          <div className="mt-6 rounded-xl bg-[#fee2e2] px-3 py-2 text-left text-xs text-[#991b1b]">
            Reset link is missing or invalid. Request a new password reset.
          </div>
        ) : (
          <form className="mt-6 flex flex-col" onSubmit={handleSubmit}>
            <label
              className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white sm:mb-2 ${
                passwordPolicyError ? "border-[#fca5a5]" : "border-[#e5e7eb]"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type={showPassword ? "text" : "password"}
                name="new-password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-invalid={Boolean(passwordPolicyError)}
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
            {passwordPolicyError && (
              <div className="mb-3 text-left text-xs text-[#b91c1c] sm:mb-2">
                {passwordPolicyError}
              </div>
            )}

            <label
              className={`mb-3 flex items-center overflow-hidden rounded-xl border bg-white sm:mb-2 ${
                confirmError ? "border-[#fca5a5]" : "border-[#e5e7eb]"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-r border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                className="flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type={showConfirm ? "text" : "password"}
                name="confirm-password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                aria-invalid={Boolean(confirmError)}
              />
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center text-[#6b7280]"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </label>
            {confirmError && (
              <div className="mb-3 text-left text-xs text-[#b91c1c] sm:mb-2">
                {confirmError}
              </div>
            )}

            {password.trim() && (
              <div className="mb-3 text-left text-xs text-[#6b7280] sm:mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#374151]">Strength:</span>
                  <span className="text-[#6b7280]">{passwordStrength.label}</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-1.5 flex-1 rounded-full ${
                        passwordStrength.score > index
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

            {status && (
              <div
                className={`mb-3 rounded-xl px-3 py-2 text-left text-xs sm:mb-2 ${
                  status.type === "error"
                    ? "bg-[#fee2e2] text-[#991b1b]"
                    : "bg-[#e0f2fe] text-[#0c4a6e]"
                }`}
                role={status.type === "error" ? "alert" : "status"}
                aria-live={status.type === "error" ? "assertive" : "polite"}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              className="rounded-xl bg-[#6c4cf5] py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-[#5b3fe7] disabled:cursor-not-allowed disabled:bg-[#eceef2] disabled:text-[#b5bbc7]"
              disabled={!isReady || submitting}
            >
              {submitting ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        <div className="mt-4 text-xs text-[#9ca3af]">
          Remembered your password?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
