import { z } from "zod";

import { normalizeDigits } from "../../../shared/forms/numbers.ts";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "ایمیل را وارد کنید.")
  .max(320, "ایمیل بیش از حد طولانی است.")
  .email("لطفاً یک ایمیل معتبر وارد کنید.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "رمز عبور را وارد کنید.")
    .max(128, "رمز عبور نمی‌تواند بیشتر از ۱۲۸ نویسه باشد."),
});

export const registerPasswordSchema = z
  .string()
  .min(12, "رمز عبور باید حداقل ۱۲ نویسه باشد.")
  .max(128, "رمز عبور نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.")
  .refine((value) => !/^\d+$/.test(value), "رمز عبور نمی‌تواند فقط شامل اعداد باشد.");

export const registerSchema = z.object({
  email: emailSchema,
  password: registerPasswordSchema,
  fullName: z
    .string()
    .trim()
    .min(1, "نام و نام خانوادگی را وارد کنید.")
    .max(100, "نام نمی‌تواند بیشتر از ۱۰۰ نویسه باشد."),
});

export const verificationCodeSchema = z
  .string()
  .transform((value) => normalizeDigits(value).replace(/\D/g, "").slice(0, 6))
  .pipe(z.string().regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد."));

export const verificationSchema = z.object({
  email: emailSchema,
  verificationCode: verificationCodeSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type VerificationFormValues = z.infer<typeof verificationSchema>;
