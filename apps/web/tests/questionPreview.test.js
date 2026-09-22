import assert from "node:assert/strict";
import test from "node:test";

import { presentationTheme } from "../src/shared/styles/presentationTheme.ts";
import {
  createQuestionDraft,
  questionDraftReducer,
} from "../src/modules/presentations/editor/model/questionDraft.ts";
import { createQuestionPreviewModel } from "../src/modules/presentations/editor/model/questionPreview.ts";

const slide = {
  slide_id: "slide-preview",
  revision: 7,
  order: 0,
  slide_type: 1,
  show_leaderboard_after: true,
  question: {
    question_id: "slide-preview",
    title: "",
    text: "کدام گزینه درست است؟",
    question_text: "کدام گزینه درست است؟",
    question_type: "multiple",
    time_limit: 30,
    question_time: 30,
    min_point: 20,
    max_point: 100,
    image_url: "",
    question_image: "",
    faster_answers_more_points: true,
    partial_scoring: true,
    options: [
      { option_id: "a", text: "الف", is_correct: true, image_url: "", order: 1 },
      { option_id: "b", text: "ب", is_correct: false, image_url: "", order: 2 },
      { option_id: "c", text: "ج", is_correct: true, image_url: "", order: 3 },
    ],
  },
};

test("question preview is derived from the active localized draft", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);

  let state = { baseline: draft, draft };
  state = questionDraftReducer(state, { type: "time", value: "۴۵" });
  state = questionDraftReducer(state, {
    type: "question-text",
    value: "نسخهٔ ذخیره‌نشدهٔ سؤال",
  });

  const preview = createQuestionPreviewModel(state.draft);

  assert.equal(preview.questionText, "نسخهٔ ذخیره‌نشدهٔ سؤال");
  assert.equal(preview.durationLabel, "۴۵ ثانیه");
  assert.equal(preview.pointsLabel, "۲۰ تا ۱۰۰ امتیاز");
  assert.equal(preview.typeLabel, "چندگزینه‌ای");
  assert.equal(preview.partialScoring, true);
  assert.equal(preview.showLeaderboardAfter, true);
});

test("question preview preserves option ordering and authoring correctness markers", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);

  const moved = questionDraftReducer(
    { baseline: draft, draft },
    { type: "move-option", from: 2, to: 0 },
  ).draft;

  const preview = createQuestionPreviewModel(moved);
  assert.deepEqual(
    preview.options.map((option) => option.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    preview.options.map((option) => option.isCorrect),
    [true, true, false],
  );
});

test("question preview degrades invalid numeric draft input without throwing", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);

  const preview = createQuestionPreviewModel({
    ...draft,
    timeInput: "نامعتبر",
    minPointsInput: "۱۰۱",
    maxPointsInput: "۱۰۰",
  });

  assert.equal(preview.durationLabel, "زمان نامعتبر");
  assert.equal(preview.pointsLabel, "امتیاز نامعتبر");
  assert.ok(preview.validationIssueCount > 0);
});

test("shared presentation theme corrects inaccessible foreground choices", () => {
  const light = presentationTheme({
    background: { color: "#ffffff", text_color: "#ffffff" },
  });
  assert.equal(light.foreground, "#0f172a");

  const dark = presentationTheme({
    background: { color: "#111111", text_color: "#111111" },
  });
  assert.equal(dark.foreground, "#ffffff");
});
