import assert from "node:assert/strict";
import test from "node:test";

import {
  emailSchema,
  loginSchema,
  registerSchema,
  verificationCodeSchema,
  verificationSchema,
} from "../src/modules/identity/model/authSchemas.ts";

test("identity schemas mirror the OpenAPI form constraints", () => {
  assert.equal(emailSchema.safeParse("not-an-email").success, false);
  assert.equal(
    loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({
      email: "user@example.com",
      password: "123456789012",
      fullName: "کاربر آزمایشی",
    }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({
      email: "user@example.com",
      password: "Safe-password-123",
      fullName: "کاربر آزمایشی",
    }).success,
    true,
  );
});

test("verification codes accept Persian and Arabic-Indic digits canonically", () => {
  assert.equal(verificationCodeSchema.parse("۱۲٣٤۵۶"), "123456");
  assert.equal(verificationCodeSchema.safeParse("۱۲۳۴۵").success, false);
  assert.equal(
    verificationSchema.safeParse({
      email: "user@example.com",
      verificationCode: "١٢٣٤٥٦",
    }).success,
    true,
  );
});
