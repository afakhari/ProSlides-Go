import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Seo from "../../../components/Seo";
import { ApiError } from "../../../shared/api/http.ts";
import { formatPersianNumber } from "../../../shared/forms/numbers.ts";
import { createZodResolver } from "../../../shared/forms/zodResolver.ts";
import { identityApi } from "../api/identityApi.ts";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "../model/resetPasswordSchema.ts";

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

function EyeIcon({ open }: { open: boolean }) {
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

const passwordStrength = (value: string) => {
  if (!value) return { score: 0, label: "ضعیف" };

  const variety = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  let score = 0;
  if (value.length >= 12) score += 2;
  else if (value.length >= 8) score += 1;
  if (variety >= 2) score += 1;
  if (variety >= 3) score += 1;

  return {
    score,
    label:
      score >= 4 ? "قوی" : score === 3 ? "خوب" : score === 2 ? "معمولی" : "ضعیف",
  };
};

const resetErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return "تنظیم مجدد رمز عبور انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.";
  }

  if (error.status === 429) {
    const wait = error.retryAfterSeconds;
    return wait == null
      ? "تعداد تلاش‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
      : `تعداد تلاش‌ها بیش از حد مجاز است. ${formatPersianNumber(wait)} ثانیه دیگر دوباره تلاش کنید.`;
  }

  if (error.status === 400) {
    return "لینک بازنشانی نامعتبر یا منقضی شده است، یا رمز عبور شرایط لازم را ندارد.";
  }

  return "تنظیم مجدد رمز عبور انجام نشد. دوباره تلاش کنید.";
};

export default function ResetPasswordRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: createZodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  const strength = passwordStrength(password);

  const onSubmit = handleSubmit(async (values) => {
    if (!uid || !token) return;
    setStatus(null);

    try {
      await identityApi.confirmPasswordReset({
        uid,
        token,
        new_password: values.password,
      });
      setStatus({
        type: "success",
        message: "رمز عبور شما به‌روزرسانی شد. اکنون می‌توانید وارد شوید.",
      });
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      setStatus({ type: "error", message: resetErrorMessage(error) });
    }
  });

  const passwordError = errors.password?.message;
  const confirmError = errors.confirmPassword?.message;

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
        title="بازنشانی رمز عبور | ProSlides"
        description="برای حساب ProSlides خود رمز عبور جدید تعیین کنید."
        canonical="https://proslides.ir/reset-password"
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage: "radial-gradient(#dce6f4 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="absolute inset-x-0 top-6 z-10 px-6 md:px-4">
        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-lg font-semibold text-[#1b2430] before:text-xl before:content-['✱']"
          >
            ProSlides
          </Link>
        </div>
      </div>

      <main className="relative z-[2] w-[min(92vw,430px)] animate-[auth-card-in_0.6s_ease-out_both] rounded-[28px] bg-white px-6 pb-7 pt-8 text-center shadow-[0_28px_60px_rgba(15,23,42,0.14)] sm:px-8 sm:pb-8 sm:pt-9 md:px-6 md:pt-8">
        <h1 className="text-[28px] font-semibold leading-tight text-[#1f2937]">
          بازنشانی رمز عبور
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          یک رمز عبور جدید برای حساب خود تعیین کنید.
        </p>

        {!uid || !token ? (
          <div className="mt-6 rounded-xl bg-[#fee2e2] px-3 py-2 text-start text-xs text-[#991b1b]" role="alert">
            لینک بازنشانی ناقص یا نامعتبر است. دوباره درخواست بازنشانی رمز عبور بدهید.
          </div>
        ) : (
          <form className="mt-6 flex flex-col" onSubmit={onSubmit} noValidate>
            <label className="mb-2 text-start text-sm font-medium text-[#374151]" htmlFor="new-password">
              رمز عبور جدید
            </label>
            <div
              className={`mb-2 flex items-center overflow-hidden rounded-xl border bg-white ${
                passwordError ? "border-[#fca5a5]" : "border-[#e5e7eb]"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-e border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                id="new-password"
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="حداقل ۱۲ نویسه"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "new-password-error" : "new-password-help"}
                {...register("password")}
              />
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center text-[#6b7280]"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {passwordError ? (
              <p id="new-password-error" className="mb-3 text-start text-xs text-[#b91c1c]">
                {passwordError}
              </p>
            ) : (
              <p id="new-password-help" className="mb-3 text-start text-xs text-[#6b7280]">
                حداقل ۱۲ نویسه وارد کنید و از رمز عبور صرفاً عددی استفاده نکنید.
              </p>
            )}

            <label className="mb-2 text-start text-sm font-medium text-[#374151]" htmlFor="confirm-password">
              تکرار رمز عبور
            </label>
            <div
              className={`mb-2 flex items-center overflow-hidden rounded-xl border bg-white ${
                confirmError ? "border-[#fca5a5]" : "border-[#e5e7eb]"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center border-e border-[#e5e7eb] text-[#6b7280]">
                <LockIcon />
              </span>
              <input
                id="confirm-password"
                className="min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="رمز عبور را دوباره وارد کنید"
                aria-invalid={Boolean(confirmError)}
                aria-describedby={confirmError ? "confirm-password-error" : undefined}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center text-[#6b7280]"
                onClick={() => setShowConfirm((value) => !value)}
                aria-label={showConfirm ? "پنهان کردن تکرار رمز" : "نمایش تکرار رمز"}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {confirmError && (
              <p id="confirm-password-error" className="mb-3 text-start text-xs text-[#b91c1c]">
                {confirmError}
              </p>
            )}

            {password && (
              <div className="mb-4 text-start text-xs text-[#6b7280]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#374151]">قدرت رمز:</span>
                  <span>{strength.label}</span>
                </div>
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-1.5 flex-1 rounded-full ${
                        strength.score > index ? "bg-[#6c4cf5]" : "bg-[#e5e7eb]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {status && (
              <div
                className={`mb-3 rounded-xl px-3 py-2 text-start text-xs ${
                  status.type === "error"
                    ? "bg-[#fee2e2] text-[#991b1b]"
                    : "bg-[#dcfce7] text-[#166534]"
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
              disabled={isSubmitting}
            >
              {isSubmitting ? "در حال به‌روزرسانی…" : "به‌روزرسانی رمز عبور"}
            </button>
          </form>
        )}

        <div className="mt-4 text-xs text-[#6b7280]">
          رمز عبور خود را به یاد دارید؟{" "}
          <Link
            to="/login"
            className="font-semibold text-[#6c4cf5] transition hover:text-[#4f32e6] hover:underline"
          >
            ورود
          </Link>
        </div>
      </main>
    </div>
  );
}
