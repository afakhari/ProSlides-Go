import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import Seo from "../../../shared/ui/Seo.tsx";
import { createZodResolver } from "../../../shared/forms/zodResolver.ts";
import { identityApi } from "../api/identityApi.ts";
import {
  identityErrorCode,
  identityErrorMessage,
  identityFieldErrors,
  retryAfterSeconds,
} from "../api/identityErrors.ts";
import { useGoogleIdentity } from "../hooks/useGoogleIdentity.ts";
import { useVerificationTimers } from "../hooks/useVerificationTimers.ts";
import {
  DEFAULT_OTP_TTL_SECONDS,
  PASSWORD_PROMPT_FLAG,
  getOtpExpirySeconds,
  getPasswordStrength,
  getResendSeconds,
  maskEmail,
  resolveAuthMode,
  resolveAuthReturnPath,
  type AuthMode,
  type AuthStatus,
} from "../model/authFlow.ts";
import {
  loginFormSchema,
  loginSchema,
  registerFormSchema,
  registerSchema,
  verificationFormSchema,
  verificationSchema,
  type AuthFormValues,
} from "../model/authSchemas.ts";
import AuthBackdrop from "../ui/AuthBackdrop.tsx";
import AuthCard from "../ui/AuthCard.tsx";

const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError ||
  String((error as { message?: string } | null)?.message || "").includes(
    "Failed to fetch",
  );

export default function AuthRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialMode = useMemo(
    () => resolveAuthMode(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [status, setStatus] = useState<AuthStatus>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const isVerify = mode === "verify";
  const activeSchema = isVerify
    ? verificationFormSchema
    : isSignup
      ? registerFormSchema
      : loginFormSchema;

  const formResolver = useMemo(
    () => createZodResolver(activeSchema),
    [activeSchema],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    setFocus,
    getValues,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<AuthFormValues>({
    resolver: formResolver,
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
  const trimmedEmail = email.trim();
  const submitting = actionSubmitting || formSubmitting;

  const {
    resendCooldown,
    otpExpiresIn,
    startResendCooldown,
    startOtpExpiry,
    expireOtp,
    resetVerificationTimers,
  } = useVerificationTimers({
    active: isVerify,
    email: trimmedEmail,
  });

  useEffect(() => {
    setMode(initialMode);
    setStatus(null);
    clearErrors();
    resetVerificationTimers();
    setValue("password", "");
    setValue("verificationCode", "");
  }, [
    clearErrors,
    initialMode,
    resetVerificationTimers,
    setValue,
  ]);

  const passwordStrength = useMemo(
    () => getPasswordStrength(password.trim()),
    [password],
  );

  const ready = useMemo(() => {
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
    fullName,
    isSignup,
    isVerify,
    password,
    trimmedEmail,
    verificationCode,
  ]);

  const navigateToDashboard = useCallback(() => {
    navigate(resolveAuthReturnPath(location.search));
  }, [location.search, navigate]);

  const applyServerFieldErrors = useCallback(
    (error: unknown) => {
      const fieldErrors = identityFieldErrors(error);
      const entries: Array<[keyof AuthFormValues, string | undefined]> = [
        ["email", fieldErrors.email],
        ["password", fieldErrors.password],
        ["fullName", fieldErrors.full_name],
        ["verificationCode", fieldErrors.code],
      ];

      const present = entries.filter(
        (entry): entry is [keyof AuthFormValues, string] => Boolean(entry[1]),
      );

      for (const [field, message] of present) {
        setError(field, { type: "server", message });
      }
      if (present[0]) setFocus(present[0][0]);
    },
    [setError, setFocus],
  );

  const setRequestFailure = useCallback(
    (error: unknown, fallback?: string) => {
      applyServerFieldErrors(error);
      setStatus({
        type: isNetworkError(error) ? "network" : "error",
        message: identityErrorMessage(error, fallback),
      });
    },
    [applyServerFieldErrors],
  );

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setActionSubmitting(true);
      setStatus(null);

      try {
        const payload = await identityApi.authenticateWithGoogle({
          token: credential,
        });

        if (payload?.needs_password_setup || payload?.is_new_user) {
          localStorage.setItem(PASSWORD_PROMPT_FLAG, "1");
        }

        navigateToDashboard();
      } catch (error) {
        setRequestFailure(error, "ورود با گوگل ناموفق بود.");
      } finally {
        setActionSubmitting(false);
      }
    },
    [navigateToDashboard, setRequestFailure],
  );

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const {
    signIn: handleGoogleSignIn,
    cookieSettingsUrl,
    cookieSettingsLabel,
    openCookieSettings,
    openCookieHelp,
  } = useGoogleIdentity({
    clientId: googleClientId,
    onCredential: handleGoogleCredential,
    onStatus: setStatus,
  });

  const handleModeSwitch = useCallback(() => {
    const nextMode: AuthMode = mode === "login" ? "signup" : "login";
    setMode(nextMode);
    navigate(nextMode === "signup" ? "/signup" : "/login", { replace: true });
    setStatus(null);
    clearErrors();
    resetVerificationTimers();
    setValue("password", "");
    setValue("verificationCode", "");
  }, [
    clearErrors,
    mode,
    navigate,
    resetVerificationTimers,
    setValue,
  ]);

  const handleEditEmail = useCallback(() => {
    setMode("login");
    navigate("/login", { replace: true });
    setStatus(null);
    clearErrors();
    resetVerificationTimers();
    setValue("verificationCode", "");
  }, [
    clearErrors,
    navigate,
    resetVerificationTimers,
    setValue,
  ]);

  const handleLogin = useCallback(
    async (values: AuthFormValues) => {
      try {
        const payload = await identityApi.login({
          email: values.email.trim(),
          password: values.password,
        });

        void payload;
        navigateToDashboard();
      } catch (error) {
        applyServerFieldErrors(error);

        if (identityErrorCode(error) === "email_not_verified") {
          setValue("password", "");
          clearErrors();
          setMode("verify");
          setStatus({
            type: "info",
            message:
              "حساب کاربری هنوز تأیید نشده است. کد ارسال‌شده به ایمیل خود را بررسی کنید یا دوباره ارسال نمایید.",
          });
          startOtpExpiry(DEFAULT_OTP_TTL_SECONDS);
          return;
        }

        throw error;
      }
    },
    [
      applyServerFieldErrors,
      clearErrors,
      navigateToDashboard,
      setValue,
      startOtpExpiry,
    ],
  );

  const handleForgotPassword = useCallback(async () => {
    const currentEmail = getValues("email").trim();
    if (!currentEmail) {
      setStatus({
        type: "error",
        message: "برای بازیابی رمز عبور، ابتدا ایمیل خود را وارد کنید.",
      });
      setFocus("email");
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
      setRequestFailure(
        error,
        "امکان ارسال راهنمای بازیابی وجود ندارد.",
      );
    } finally {
      setActionSubmitting(false);
    }
  }, [getValues, setFocus, setRequestFailure]);

  const handleSignup = useCallback(
    async (values: AuthFormValues) => {
      const trimmedName = values.fullName.trim();

      try {
        const responsePayload = await identityApi.register({
          email: values.email.trim(),
          password: values.password,
          display_name: trimmedName,
        });

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
          getOtpExpirySeconds(
            responsePayload,
            DEFAULT_OTP_TTL_SECONDS,
          ),
        );
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
    },
    [
      applyServerFieldErrors,
      clearErrors,
      navigateToDashboard,
      setValue,
      startOtpExpiry,
      startResendCooldown,
    ],
  );

  const handleVerify = useCallback(
    async (values: AuthFormValues) => {
      try {
        await identityApi.verifyEmail({
          email: values.email.trim(),
          code: values.verificationCode,
        });

        navigateToDashboard();
      } catch (error) {
        applyServerFieldErrors(error);
        if (identityErrorCode(error) === "verification_expired") {
          expireOtp();
        }
        setStatus({
          type:
            identityErrorCode(error) === "verification_expired"
              ? "otp-expired"
              : isNetworkError(error)
                ? "network"
                : "error",
          message: identityErrorMessage(
            error,
            "امکان تأیید ایمیل وجود ندارد.",
          ),
        });
      }
    },
    [
      applyServerFieldErrors,
      expireOtp,
      navigateToDashboard,
    ],
  );

  const handleResendVerification = useCallback(async () => {
    const currentEmail = getValues("email").trim();
    if (!currentEmail) {
      setStatus({
        type: "error",
        message: "برای ارسال مجدد کد، ایمیل خود را وارد کنید.",
      });
      setFocus("email");
      return;
    }

    setActionSubmitting(true);
    setStatus(null);

    try {
      const payload = await identityApi.resendVerification({
        email: currentEmail,
      });
      setStatus({ type: "info", message: "کد تأیید ارسال شد." });
      startResendCooldown(getResendSeconds(payload, 60));
      startOtpExpiry(
        getOtpExpirySeconds(payload, DEFAULT_OTP_TTL_SECONDS),
      );
      setValue("verificationCode", "");
    } catch (error) {
      const retrySeconds = retryAfterSeconds(error, resendCooldown);
      if (retrySeconds > 0) startResendCooldown(retrySeconds);
      setRequestFailure(error, "امکان ارسال مجدد کد وجود ندارد.");
    } finally {
      setActionSubmitting(false);
    }
  }, [
    getValues,
    resendCooldown,
    setFocus,
    setRequestFailure,
    setValue,
    startOtpExpiry,
    startResendCooldown,
  ]);

  const submitForm = handleSubmit(async (values) => {
    setStatus(null);
    clearErrors();

    try {
      if (mode === "verify") {
        await handleVerify(values);
      } else if (mode === "signup") {
        await handleSignup(values);
      } else {
        await handleLogin(values);
      }
    } catch (error) {
      setRequestFailure(error);
    }
  });

  const seoTitle =
    mode === "verify"
      ? "تایید ایمیل | پرو اسلایدز"
      : mode === "signup"
        ? "ثبت‌نام در پرو اسلایدز | شروع ارائه‌های تعاملی"
        : "ورود به پرو اسلایدز | مدیریت ارائه‌های تعاملی";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 pb-8 pt-8 font-sans sm:px-5 sm:pb-10 sm:pt-14 md:pb-[70px] md:pt-[120px]">
      <Seo
        title={seoTitle}
        description="ورود یا ثبت‌نام در پرو اسلایدز برای ساخت و مدیریت ارائه‌های تعاملی با نظرسنجی زنده و کوییز."
        canonical={`https://proslides.ir/${mode === "signup" ? "signup" : "login"}`}
      />
      <AuthBackdrop decorate={!isVerify} />
      <AuthCard
        mode={mode}
        email={trimmedEmail}
        password={password}
        errors={errors}
        passwordStrength={passwordStrength}
        status={status}
        submitting={submitting}
        ready={ready}
        resendCooldown={resendCooldown}
        otpExpiresIn={otpExpiresIn}
        register={register}
        onSubmit={() => void submitForm()}
        onModeSwitch={handleModeSwitch}
        onEditEmail={handleEditEmail}
        onGoogleSignIn={handleGoogleSignIn}
        onForgotPassword={handleForgotPassword}
        onResendVerification={handleResendVerification}
        onRetryNetwork={() => void submitForm()}
        onOpenCookieSettings={openCookieSettings}
        onOpenCookieHelp={openCookieHelp}
        cookieSettingsUrl={cookieSettingsUrl}
        cookieSettingsLabel={cookieSettingsLabel}
      />
    </div>
  );
}
