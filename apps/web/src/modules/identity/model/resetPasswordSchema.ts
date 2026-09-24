import { z } from "zod";

import { newPasswordSchema } from "./authSchemas.ts";

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیست.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
