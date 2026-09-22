import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/shared/api/http.ts";
import {
  identityErrorCode,
  identityErrorMessage,
  identityFieldErrors,
  retryAfterSeconds,
} from "../src/modules/identity/api/identityErrors.ts";

test("identity errors map machine codes to Persian product copy", () => {
  const invalid = new ApiError(401, { error: "invalid_credentials" });
  assert.equal(identityErrorCode(invalid), "invalid_credentials");
  assert.equal(identityErrorMessage(invalid), "ایمیل یا رمز عبور نادرست است.");

  const taken = new ApiError(409, { error: "email_taken" });
  assert.deepEqual(identityFieldErrors(taken), {
    email: "این ایمیل قبلاً ثبت شده است.",
  });

  const expired = new ApiError(400, { error: "verification_expired" });
  assert.deepEqual(identityFieldErrors(expired), {
    code: "کد تأیید منقضی شده است.",
  });
});

test("identity errors preserve structured field and retry metadata", () => {
  const error = new ApiError(429, {
    error: "resend_too_soon",
    field_errors: {
      email: ["ایمیل معتبر نیست."],
      display_name: ["نام را وارد کنید."],
    },
    retry_after_seconds: 37,
  });

  assert.deepEqual(identityFieldErrors(error), {
    email: "ایمیل معتبر نیست.",
    full_name: "نام را وارد کنید.",
  });
  assert.equal(retryAfterSeconds(error, 5), 37);
});

test("network failures use a safe Persian fallback", () => {
  assert.match(
    identityErrorMessage(new TypeError("Failed to fetch")),
    /ارتباط با سرور برقرار نشد/,
  );
  assert.equal(retryAfterSeconds(new Error("x"), 9), 9);
});
