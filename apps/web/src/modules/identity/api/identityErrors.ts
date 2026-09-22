import { ApiError } from "../../../shared/api/http.ts";

export type IdentityFieldErrors = Partial<
  Record<"email" | "password" | "full_name" | "code" | "form", string>
>;

const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: "ایمیل یا رمز عبور نادرست است.",
  email_taken: "این ایمیل قبلاً ثبت شده است.",
  invalid_request: "اطلاعات واردشده معتبر نیست.",
  email_not_verified: "حساب کاربری هنوز تأیید نشده است.",
  verification_expired: "کد تأیید منقضی شده است.",
  verification_attempts_exceeded:
    "تعداد تلاش‌های تأیید بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  invalid_verification: "کد تأیید معتبر نیست.",
  resend_too_soon: "برای ارسال مجدد کد کمی صبر کنید.",
  verification_unavailable:
    "در حال حاضر امکان ارسال کد تأیید وجود ندارد. کمی بعد دوباره تلاش کنید.",
  authentication_unavailable:
    "سرویس ورود موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.",
  google_auth_unavailable:
    "ورود با گوگل موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.",
  invalid_google_credential:
    "ورود با گوگل ناموفق بود. لطفاً دوباره تلاش کنید.",
  password_reset_unavailable:
    "سرویس ارسال ایمیل بازیابی هنوز پیکربندی نشده یا موقتاً در دسترس نیست.",
  invalid_or_expired_reset:
    "لینک بازنشانی نامعتبر یا منقضی شده است.",
  rate_limited:
    "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  unauthorized: "نشست شما معتبر نیست. دوباره وارد شوید.",
  csrf_failed: "اعتبار امنیتی درخواست منقضی شده است. صفحه را تازه‌سازی کنید.",
  internal_error: "خطایی در سرور رخ داد. کمی بعد دوباره تلاش کنید.",
};

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export const identityErrorMessage = (
  error: unknown,
  fallback = "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
): string => {
  if (!(error instanceof ApiError)) {
    if (
      error instanceof TypeError ||
      String((error as { message?: string } | null)?.message || "").includes("Failed to fetch")
    ) {
      return "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.";
    }
    return fallback;
  }

  if (error.message && error.message !== error.code && error.code === "http_error") {
    return error.message;
  }

  return CODE_MESSAGES[error.code] || fallback;
};

export const identityFieldErrors = (error: unknown): IdentityFieldErrors => {
  if (!(error instanceof ApiError)) return {};

  const fields: IdentityFieldErrors = {};
  const first = (field: string) => error.fieldErrors[field]?.[0];

  if (first("email")) fields.email = first("email");
  if (first("password")) fields.password = first("password");
  if (first("display_name")) fields.full_name = first("display_name");
  if (first("code")) fields.code = first("code");

  if (error.code === "email_taken" && !fields.email) {
    fields.email = CODE_MESSAGES.email_taken;
  }
  if (
    ["verification_expired", "verification_attempts_exceeded", "invalid_verification"].includes(
      error.code,
    ) &&
    !fields.code
  ) {
    fields.code = CODE_MESSAGES[error.code];
  }

  return fields;
};

export const retryAfterSeconds = (error: unknown, fallback = 0): number => {
  if (!(error instanceof ApiError)) return fallback;
  return error.retryAfterSeconds ?? fallback;
};

export const identityErrorCode = (error: unknown): string =>
  error instanceof ApiError ? error.code : "";
