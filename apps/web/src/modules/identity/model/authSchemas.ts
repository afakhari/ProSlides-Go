import { z } from "zod";

import { normalizeDigits } from "../../../shared/forms/numbers.ts";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "ایمیل را وارد کنید.")
  .max(320, "ایمیل بیش از حد طولانی است.")
  .email("لطفاً یک ایمیل معتبر وارد کنید.");

const passwordFitsBcrypt = (value: string) =>
  new TextEncoder().encode(value).length <= 72;

const isOnlyDecimalDigits = (value: string) => /^\p{Nd}+$/u.test(value);

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "رمز عبور را وارد کنید.")
    .max(128, "رمز عبور نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.")
    .refine(passwordFitsBcrypt, "رمز عبور بیش از حد طولانی است."),
});

export const newPasswordSchema = z
  .string()
  .min(12, "رمز عبور باید حداقل ۱۲ نویسه باشد.")
  .max(128, "رمز عبور نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.")
  .refine(passwordFitsBcrypt, "رمز عبور بیش از حد طولانی است.")
  .refine((value) => !isOnlyDecimalDigits(value), "رمز عبور نمی‌تواند فقط شامل اعداد باشد.");

const registerPasswordSchema = newPasswordSchema;

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

const inactiveAuthField = z.string();

export const loginFormSchema = loginSchema.extend({
  verificationCode: inactiveAuthField,
  fullName: inactiveAuthField,
});

export const registerFormSchema = registerSchema.extend({
  verificationCode: inactiveAuthField,
});

export const verificationFormSchema = verificationSchema.extend({
  password: inactiveAuthField,
  fullName: inactiveAuthField,
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type VerificationFormValues = z.infer<typeof verificationSchema>;
export type AuthFormValues = z.infer<typeof registerFormSchema>;
