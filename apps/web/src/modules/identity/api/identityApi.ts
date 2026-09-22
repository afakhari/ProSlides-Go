import { requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

type PasswordResetConfirmRequest = components["schemas"]["PasswordResetConfirmRequest"];

export const identityApi = {
  confirmPasswordReset: (input: PasswordResetConfirmRequest): Promise<void> =>
    requestJson<void>("/auth/password/reset/confirm", {
      method: "POST",
      json: input,
    }),
};
