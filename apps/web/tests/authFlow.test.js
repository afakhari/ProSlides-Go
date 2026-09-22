import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCountdown,
  getGooglePromptFeedback,
  getPasswordStrength,
  getResendSeconds,
  maskEmail,
  resolveAuthMode,
} from "../src/modules/identity/model/authFlow.ts";
import { remainingSecondsUntil } from "../src/modules/identity/hooks/useVerificationTimers.ts";

test("auth route mode follows explicit route/query ownership", () => {
  assert.equal(resolveAuthMode("/login", ""), "login");
  assert.equal(resolveAuthMode("/signup", ""), "signup");
  assert.equal(resolveAuthMode("/auth", "?mode=signup"), "signup");
  assert.equal(resolveAuthMode("/auth", "?mode=login"), "login");
});

test("verification timing helpers preserve deadlines instead of extending expired codes", () => {
  assert.equal(remainingSecondsUntil(11_000, 1_000), 10);
  assert.equal(remainingSecondsUntil(1_000, 1_001), 0);
  assert.equal(remainingSecondsUntil(null, 1_000), 0);
  assert.equal(formatCountdown(600), "10:00");
  assert.equal(formatCountdown(65), "1:05");
});

test("auth display helpers keep identifiers safe and payload timing bounded", () => {
  assert.equal(maskEmail("someone@example.com"), "so***@example.com");
  assert.equal(maskEmail("a@example.com"), "a*@example.com");
  assert.equal(getResendSeconds({ retry_after_seconds: 42 }, 60), 42);
  assert.equal(getResendSeconds({ retry_after_seconds: -3 }, 60), 0);
});

test("password strength and Google prompt feedback remain deterministic", () => {
  assert.deepEqual(getPasswordStrength(""), { score: 0, label: "ضعیف" });
  assert.equal(getPasswordStrength("Valid-password-123").label, "قوی");
  assert.equal(getGooglePromptFeedback("user_cancel"), null);
  assert.equal(getGooglePromptFeedback("cookie_blocked")?.type, "google-cookies");
  assert.equal(getGooglePromptFeedback("browser_not_supported")?.type, "error");
});
