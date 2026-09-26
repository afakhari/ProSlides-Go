import { requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

type RegisterRequest = components["schemas"]["RegisterRequest"];
type RegistrationResult = components["schemas"]["RegistrationResult"];
type LoginRequest = components["schemas"]["LoginRequest"];
type CurrentUser = components["schemas"]["CurrentUser"];
type VerifyEmailRequest = components["schemas"]["VerifyEmailRequest"];
type ResendVerificationRequest = components["schemas"]["ResendVerificationRequest"];
type VerificationDeliveryResult = components["schemas"]["VerificationDeliveryResult"];
type GoogleAuthRequest = components["schemas"]["GoogleAuthRequest"];
type GoogleAuthResult = components["schemas"]["GoogleAuthResult"];
type PasswordResetRequest = components["schemas"]["PasswordResetRequest"];
type PasswordResetConfirmRequest = components["schemas"]["PasswordResetConfirmRequest"];

const publicJson = <T>(path: string, method: "POST", json: unknown): Promise<T> =>
  requestJson<T>(path, {
    method,
    json,
    announceAuthExpiry: false,
  });

export const identityApi = {
  register: (input: RegisterRequest): Promise<RegistrationResult> =>
    publicJson<RegistrationResult>("/auth/register", "POST", input),

  login: (input: LoginRequest): Promise<CurrentUser> =>
    publicJson<CurrentUser>("/auth/login", "POST", input),

  verifyEmail: (input: VerifyEmailRequest): Promise<CurrentUser> =>
    publicJson<CurrentUser>("/auth/verify", "POST", input),

  resendVerification: (
    input: ResendVerificationRequest,
  ): Promise<VerificationDeliveryResult> =>
    publicJson<VerificationDeliveryResult>("/auth/verify/resend", "POST", input),

  authenticateWithGoogle: (input: GoogleAuthRequest): Promise<GoogleAuthResult> =>
    publicJson<GoogleAuthResult>("/auth/google", "POST", input),

  requestPasswordReset: (input: PasswordResetRequest): Promise<void> =>
    publicJson<void>("/auth/password/reset", "POST", input),

  confirmPasswordReset: (input: PasswordResetConfirmRequest): Promise<void> =>
    publicJson<void>("/auth/password/reset/confirm", "POST", input),

  getCurrentUser: (options: { signal?: AbortSignal } = {}): Promise<CurrentUser> =>
    requestJson<CurrentUser>("/auth/me", {
      signal: options.signal,
      announceAuthExpiry: false,
    }),

  logout: (): Promise<void> =>
    requestJson<void>("/auth/logout", { method: "POST" }),
};

