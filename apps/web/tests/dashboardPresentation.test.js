import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNumber,
  getDuplicateTitle,
  getVersionInfo,
  localizeSystemTitle,
  normalizePersianText,
  safeTimestamp,
  toDashboardQuiz,
  toPersianUiMessage,
} from "../src/modules/presentations/dashboard/model/dashboardPresentation.ts";

test("dashboard title helpers localize system names and preserve version semantics", () => {
  assert.equal(localizeSystemTitle("Untitled Presentation"), "ارائه بدون عنوان");
  assert.equal(
    localizeSystemTitle("Untitled Presentation (copy 2)"),
    `ارائه بدون عنوان - نسخه ${formatNumber(3)}`,
  );
  assert.deepEqual(getVersionInfo("آزمون - نسخه ۳"), {
    baseName: "آزمون",
    version: 3,
  });
});

test("duplicate naming compares normalized Persian text across digit and glyph variants", () => {
  const quizzes = [
    { name: "آزمون - نسخه ۲" },
    { name: "آزمون - نسخه ۴" },
    { name: "آزمون دیگر" },
  ];
  assert.equal(
    getDuplicateTitle({ name: "آزمون" }, quizzes),
    `آزمون - نسخه ${formatNumber(5)}`,
  );
  assert.equal(normalizePersianText("  كلاس ١۲  "), "کلاس 12");
});

test("safeTimestamp accepts seconds milliseconds ISO dates and rejects invalid values", () => {
  assert.equal(safeTimestamp(1_700_000_000), 1_700_000_000_000);
  assert.equal(safeTimestamp("1700000000000"), 1_700_000_000_000);
  assert.equal(safeTimestamp("not-a-date"), 0);
  assert.equal(safeTimestamp(""), 0);
});

test("dashboard DTO projection is typed normalized and keeps owner fallback", () => {
  const quiz = toDashboardQuiz({
    id: "presentation-1",
    revision: 4,
    title: "Untitled Presentation",
    access_code: null,
    settings: {},
    slide_count: 7,
    participant_count: 12,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-21T11:00:00Z",
  }, "کاربر");

  assert.equal(quiz.id, "presentation-1");
  assert.equal(quiz.revision, 4);
  assert.equal(quiz.name, "ارائه بدون عنوان");
  assert.equal(quiz.accessCode, "");
  assert.equal(quiz.slides, 7);
  assert.equal(quiz.participants, 12);
  assert.equal(quiz.createdBy, "کاربر");
  assert.ok(quiz.updatedAt > quiz.createdAt);
});

test("dashboard errors only reuse already-Persian server copy", () => {
  assert.equal(toPersianUiMessage("خطای معتبر", "جایگزین"), "خطای معتبر");
  assert.equal(toPersianUiMessage("network failed", "خطای شبکه"), "خطای شبکه");
  assert.equal(toPersianUiMessage("", "خطای شبکه"), "خطای شبکه");
});
