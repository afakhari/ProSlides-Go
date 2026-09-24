import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPersianNumber,
  normalizeDigits,
  normalizeNumericInput,
  parseLocalizedNumber,
} from "../src/shared/forms/numbers.ts";
import {
  ApiError,
  normalizeApiErrorPayload,
} from "../src/shared/api/http.ts";
import { resetPasswordSchema } from "../src/modules/identity/model/resetPasswordSchema.ts";

test("normalizes Persian and Arabic-Indic digits without coercing identifiers", () => {
  assert.equal(normalizeDigits("۰۱۲٣٤5"), "012345");
  assert.equal(normalizeNumericInput("۱۲٬۳۴۵٫۶"), "12345.6");
  assert.equal(parseLocalizedNumber(" ١٢٣٫٥ "), 123.5);
  assert.equal(parseLocalizedNumber(""), null);
  assert.equal(formatPersianNumber(1234), "۱٬۲۳۴");
});

test("reset password schema mirrors the server password constraints", () => {
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "short-pass",
      confirmPassword: "short-pass",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "123456789012",
      confirmPassword: "123456789012",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "valid-password-123",
      confirmPassword: "different-password",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "valid-password-123",
      confirmPassword: "valid-password-123",
    }).success,
    true,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "é".repeat(37),
      confirmPassword: "é".repeat(37),
    }).success,
    false,
  );
});

test("API errors expose stable typed metadata and ignore malformed fields", () => {
  const payload = normalizeApiErrorPayload({
    error: "rate_limited",
    message: "safe detail",
    field_errors: {
      email: ["email_taken", 42],
      empty: [],
    },
    retry_after_seconds: 12,
    request_id: "request-1",
  });

  assert.deepEqual(payload, {
    error: "rate_limited",
    message: "safe detail",
    field_errors: { email: ["email_taken"] },
    retry_after_seconds: 12,
    request_id: "request-1",
  });

  const error = new ApiError(429, payload);
  assert.equal(error.code, "rate_limited");
  assert.deepEqual(error.fieldErrors, { email: ["email_taken"] });
  assert.equal(error.retryAfterSeconds, 12);
  assert.equal(error.requestId, "request-1");
  assert.equal(normalizeApiErrorPayload({ message: "missing machine code" }), null);
});
