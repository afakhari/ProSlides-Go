import { useState } from "react";
import type {
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";

import { normalizeDigits } from "../../../shared/forms/numbers.ts";
import Notice from "../../../shared/ui/Notice.tsx";
import type {
  AuthMode,
  AuthStatus,
  PasswordStrength,
} from "../model/authFlow.ts";
import type { AuthFormValues } from "../model/authSchemas.ts";
import { formatCountdown, maskEmail } from "../model/authFlow.ts";

type AuthCardProps = {
  mode: AuthMode;
  email: string;
  password: string;
  errors: FieldErrors<AuthFormValues>;
  passwordStrength: PasswordStrength;
  status: AuthStatus;
  submitting: boolean;
  ready: boolean;
  resendCooldown: number;
  otpExpiresIn: number;
  register: UseFormRegister<AuthFormValues>;
  onSubmit: () => void;
  onModeSwitch: () => void;
  onEditEmail: () => void;
  onGoogleSignIn: () => void;
  onForgotPassword: () => void;
  onResendVerification: () => void;
  onRetryNetwork: () => void;
  onOpenCookieSettings: () => void;
  onOpenCookieHelp: () => void;
  cookieSettingsUrl: string;
  cookieSettingsLabel: string;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.6c-.2 1.4-1.6 4.1-5.6 4.1-3.4 0-6.1-2.8-6.1-6.2S8.6 5.8 12 5.8c2 0 3.3.8 4.1 1.5l2.8-2.7C17.4 3.2 15 2 12 2 6.9 2 2.8 6.1 2.8 12S6.9 22 12 22c7 0 8.7-4.9 8.7-7.4 0-.5-.1-1-.1-1.4H12z" />
      <path fill="#34A853" d="M3.9 7.1l3.1 2.3C7.8 7.5 9.7 5.8 12 5.8c2 0 3.3.8 4.1 1.5l2.8-2.7C17.4 3.2 15 2 12 2 8.1 2 4.7 4.2 3.9 7.1z" />
      <path fill="#FBBC05" d="M12 22c3 0 5.6-1 7.4-2.8l-3.4-2.6c-.9.6-2.1 1-4 1-3.4 0-6.2-2.8-6.2-6.2 0-.7.1-1.3.3-1.9l-3.2-2.5C2.4 8.2 2 10.1 2 12c0 5.9 4.8 10 10 10z" />
      <path fill="#4285F4" d="M20.7 12.2c0-.5-.1-1-.1-1.4H12v3.9h5.6c-.3 1.4-1.6 4.1-5.6 4.1v3.2c3.2 0 7.7-2.1 8.7-6.8z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3 8 9 6 9-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="4" y="10" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 19a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {!open && <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  );
}

const fieldShell = (hasError: boolean) =>
  \`flex items-center overflow-hidden rounded-control border bg-surface transition focus-within:ring-2 focus-within:ring-focus/30 \${
    hasError ? "border-danger-border" : "border-border-subtle"
  }\`;

const errorText = "mt-1 text-start text-xs text-danger-ink";

export default function AuthCard({
  mode,
  email,
  password,
  errors,
  passwordStrength,
  status,
  submitting,
  ready,
  resendCooldown,
  otpExpiresIn,
  register,
  onSubmit,
  onModeSwitch,
  onEditEmail,
  onGoogleSignIn,
  onForgotPassword,
  onResendVerification,
  onRetryNetwork,
  onOpenCookieSettings,
  onOpenCookieHelp,
  cookieSettingsUrl,
  cookieSettingsLabel,
}: AuthCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";
  const isVerify = mode === "verify";
  const otpExpired = isVerify && otpExpiresIn === 0;
  const submitLabel = isVerify ? "تأیید" : isSignup ? "ثبت‌نام" : "ورود";

  return (
    <div className="relative z-[2] w-[min(92vw,430px)] max-h-[78vh] overflow-y-auto rounded-[28px] bg-surface px-6 pb-7 pt-8 text-center shadow-panel animate-[auth-card-in_0.6s_ease-out_both] sm:max-h-none sm:overflow-visible sm:px-8 sm:pb-8 sm:pt-9 md:px-6 md:pt-8">
      <h1 className="text-[28px] font-semibold leading-tight text-content">
        {isVerify ? "تأیید ایمیل" : isSignup ? "ثبت‌نام" : "ورود"}
      </h1>

      {isVerify && email && (
        <div className="mt-2 rounded-control bg-canvas px-3 py-2 text-start text-xs text-content-muted">
          <div>کد به <bdi dir="ltr">{maskEmail(email)}</bdi> ارسال شد.</div>
          <div className="mt-1">
            {otpExpired
              ? "کد منقضی شده است. یک کد جدید درخواست کنید."
              : \`انقضا تا \${formatCountdown(otpExpiresIn)}\`}
          </div>
        </div>
      )}

      <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm text-content-muted">
        {isVerify ? "کد جدید می‌خواهید؟" : isSignup ? "حساب دارید؟" : "حساب کاربری ندارید؟"}
        <button
          type="button"
          onClick={isVerify ? onResendVerification : onModeSwitch}
          disabled={isVerify && (submitting || resendCooldown > 0)}
          className="font-semibold text-brand transition hover:text-brand-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-content-muted disabled:no-underline"
        >
          {isVerify
            ? resendCooldown > 0
              ? \`ارسال مجدد تا \${formatCountdown(resendCooldown)}\`
              : "ارسال مجدد کد"
            : isSignup
              ? "ورود به حساب کاربری"
              : "ثبت‌نام"}
        </button>
        {isVerify && (
          <button
            type="button"
            onClick={onEditEmail}
            className="font-semibold text-brand transition hover:text-brand-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            ویرایش ایمیل
          </button>
        )}
      </p>

      {!isVerify && (
        <>
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle bg-surface px-4 py-2.5 text-sm font-semibold text-content transition hover:border-brand-border hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {isSignup ? "ثبت‌نام با گوگل" : "ورود با گوگل"}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-content-muted">
            <span className="h-px flex-1 bg-border-subtle" />
            یا
            <span className="h-px flex-1 bg-border-subtle" />
          </div>
        </>
      )}

      <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); onSubmit(); }} noValidate>
        <div>
          <label className={fieldShell(Boolean(errors.email))}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center border-e border-border-subtle text-content-muted">
              <MailIcon />
            </span>
            <input
              className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-content outline-none placeholder:text-content-muted read-only:bg-canvas read-only:text-content-muted"
              type="email"
              autoComplete="email"
              placeholder="ایمیل شما"
              readOnly={isVerify}
              aria-readonly={isVerify || undefined}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "auth-email-error" : undefined}
              dir="ltr"
              {...register("email")}
            />
          </label>
          {errors.email?.message && <div id="auth-email-error" className={errorText}>{errors.email.message}</div>}
        </div>

        {!isVerify && (
          <div>
            <label className={fieldShell(Boolean(errors.password))}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center border-e border-border-subtle text-content-muted">
                <LockIcon />
              </span>
              <input
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-content outline-none placeholder:text-content-muted"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="رمز عبور"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "auth-password-error" : undefined}
                dir="ltr"
                {...register("password")}
              />
              <button
                type="button"
                className="flex h-12 w-12 shrink-0 items-center justify-center text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </label>
            {errors.password?.message && <div id="auth-password-error" className={errorText}>{errors.password.message}</div>}
          </div>
        )}

        {!isVerify && isSignup && password.trim() && (
          <div className="text-start text-xs text-content-muted">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-content">قدرت رمز عبور:</span>
              <span>{passwordStrength.label}</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={\`h-1.5 flex-1 rounded-full \${
                    passwordStrength.score > index ? "bg-brand" : "bg-border-subtle"
                  }\`}
                />
              ))}
            </div>
            <div className="mt-2">حداقل ۱۲ نویسه استفاده کنید و از رمز عبوری که فقط عدد است خودداری کنید.</div>
          </div>
        )}

        {isVerify ? (
          <div>
            <label className={fieldShell(Boolean(errors.verificationCode))}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center border-e border-border-subtle text-content-muted">
                <LockIcon />
              </span>
              <input
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-content outline-none placeholder:text-content-muted"
                type="text"
                inputMode="numeric"
                placeholder="کد تأیید"
                maxLength={6}
                autoComplete="one-time-code"
                aria-invalid={Boolean(errors.verificationCode)}
                aria-describedby={errors.verificationCode ? "auth-code-error" : undefined}
                dir="ltr"
                {...register("verificationCode", {
                  setValueAs: (value) =>
                    normalizeDigits(String(value)).replace(/\D/g, "").slice(0, 6),
                })}
              />
            </label>
            {errors.verificationCode?.message && <div id="auth-code-error" className={errorText}>{errors.verificationCode.message}</div>}
          </div>
        ) : isSignup ? (
          <div>
            <label className={fieldShell(Boolean(errors.fullName))}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center border-e border-border-subtle text-content-muted">
                <UserIcon />
              </span>
              <input
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-content outline-none placeholder:text-content-muted"
                type="text"
                autoComplete="name"
                placeholder="نام و نام خانوادگی"
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? "auth-name-error" : undefined}
                {...register("fullName")}
              />
            </label>
            {errors.fullName?.message && <div id="auth-name-error" className={errorText}>{errors.fullName.message}</div>}
          </div>
        ) : (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-content-muted transition hover:text-content hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              رمز عبور را فراموش کرده‌اید؟
            </button>
          </div>
        )}

        {status && (
          <Notice
            tone={
              status.type === "error"
                ? "error"
                : status.type === "network" || status.type === "google-cookies" || status.type === "otp-expired"
                  ? "warning"
                  : "info"
            }
            className="items-start text-start text-xs"
            action={
              status.type === "network" ? (
                <button type="button" onClick={onRetryNetwork} disabled={submitting} className="shrink-0 font-semibold underline">
                  تلاش مجدد
                </button>
              ) : undefined
            }
          >
            <div>{status.message}</div>
            {status.type === "google-cookies" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={onOpenCookieSettings} className="font-semibold underline">
                  {cookieSettingsLabel}
                </button>
                <button type="button" onClick={onGoogleSignIn} className="font-semibold underline">
                  تلاش مجدد با گوگل
                </button>
                {cookieSettingsUrl && (
                  <button type="button" onClick={onOpenCookieHelp} className="font-semibold underline">
                    راهنمای فعال‌سازی
                  </button>
                )}
              </div>
            )}
            {status.type === "email-exists" && (
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" onClick={onGoogleSignIn} className="font-semibold underline">استفاده از گوگل</button>
                <button type="button" onClick={onForgotPassword} className="font-semibold underline">تنظیم رمز عبور</button>
              </div>
            )}
            {status.type === "otp-expired" && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onResendVerification}
                  disabled={submitting || resendCooldown > 0}
                  className="font-semibold underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resendCooldown > 0 ? \`ارسال مجدد تا \${formatCountdown(resendCooldown)}\` : "ارسال مجدد کد"}
                </button>
              </div>
            )}
          </Notice>
        )}

        <button
          type="submit"
          className="rounded-control bg-brand py-2.5 text-sm font-semibold text-content-inverse transition enabled:hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-border-subtle disabled:text-content-muted"
          disabled={!ready || submitting}
        >
          {submitting ? "در حال پردازش..." : submitLabel}
        </button>
      </form>
    </div>
  );
}
