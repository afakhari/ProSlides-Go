import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "رمز عبور باید حداقل ۱۲ نویسه باشد.")
      .max(128, "رمز عبور نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.")
      .refine((value) => !/^\d+$/.test(value), "رمز عبور نمی‌تواند فقط شامل اعداد باشد."),
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیست.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
