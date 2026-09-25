import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuestionDraft,
  parseDraftInteger,
  questionDraftEquals,
  questionDraftReducer,
  questionDraftToEditorSlide,
  validateQuestionDraft,
} from "../src/modules/presentations/editor/model/questionDraft.ts";

const slide = {
  slide_id: "slide-1",
  revision: 3,
  order: 0,
  slide_type: 1,
  show_leaderboard_after: true,
  question: {
    question_id: "slide-1",
    title: "",
    text: "پایتخت ایران کدام است؟",
    question_text: "پایتخت ایران کدام است؟",
    question_type: "single",
    time_limit: 30,
    question_time: 30,
    min_point: 0,
    max_point: 100,
    image_url: "",
    question_image: "",
    faster_answers_more_points: false,
    partial_scoring: false,
    options: [
      { option_id: "a", text: "تهران", is_correct: true, image_url: "", order: 1 },
      { option_id: "b", text: "شیراز", is_correct: false, image_url: "", order: 2 },
    ],
  },
};

test("question draft keeps numeric input localized until serialization", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);
  assert.equal(parseDraftInteger("۱۲۳"), 123);
  assert.equal(parseDraftInteger("١٢٣"), 123);

  const state = questionDraftReducer(
    { baseline: draft, draft },
    { type: "time", value: "۴۵" },
  );

  assert.equal(state.draft.timeInput, "۴۵");
  assert.equal(questionDraftToEditorSlide(state.draft).question?.question_time, 45);
});

test("single and multiple correct-answer invariants stay valid during edits", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);

  let state = { baseline: draft, draft };
  state = questionDraftReducer(state, { type: "toggle-correct", optionId: "b" });
  assert.deepEqual(
    state.draft.options.map((option) => option.isCorrect),
    [false, true],
  );

  const multiple = { ...state.draft, type: "multiple" };
  state = { baseline: multiple, draft: multiple };
  state = questionDraftReducer(state, { type: "toggle-correct", optionId: "b" });
  assert.equal(state.draft.options[1].isCorrect, true);

  state = questionDraftReducer(state, { type: "toggle-correct", optionId: "a" });
  assert.equal(state.draft.options.filter((option) => option.isCorrect).length, 2);
});

test("question draft never deletes below the backend minimum and supports keyboard reorder actions", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);

  let state = { baseline: draft, draft };
  state = questionDraftReducer(state, { type: "delete-option", optionId: "b" });
  assert.equal(state.draft.options.length, 2);

  state = questionDraftReducer(state, { type: "move-option", from: 0, to: 1 });
  assert.deepEqual(state.draft.options.map((option) => option.id), ["b", "a"]);
});

test("dirty comparison is structural and save serialization preserves revision", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);
  assert.equal(questionDraftEquals(draft, draft), true);

  const changed = questionDraftReducer(
    { baseline: draft, draft },
    { type: "question-text", value: "سؤال تازه" },
  ).draft;

  assert.equal(questionDraftEquals(draft, changed), false);
  const serialized = questionDraftToEditorSlide(changed);
  assert.equal(serialized.revision, 3);
  assert.equal(serialized.item_kind, "activity");
  assert.equal(serialized.activity_kind, "choice");
  assert.equal(serialized.schema_version, 1);
  assert.equal(serialized.question?.text, "سؤال تازه");
  assert.deepEqual(serialized.question?.options.map((option) => option.order), [1, 2]);
});

test("draft preserves unevaluated unscored Choice policy without creating hidden scoring state", () => {
  const pollSlide = {
    ...slide,
    show_leaderboard_after: false,
    item_kind: "activity",
    activity_kind: "choice",
    schema_version: 1,
    question: {
      ...slide.question,
      evaluation_mode: "none",
      scoring_mode: "none",
      min_point: 0,
      max_point: 0,
      faster_answers_more_points: false,
      partial_scoring: false,
      options: slide.question.options.map((option) => ({
        ...option,
        is_correct: false,
      })),
    },
  };

  const draft = createQuestionDraft(pollSlide);
  assert.ok(draft);
  assert.equal(draft.evaluationMode, "none");
  assert.equal(draft.scoringMode, "none");
  assert.equal(draft.showLeaderboardAfter, false);
  assert.deepEqual(
    draft.options.map((option) => option.isCorrect),
    [false, false],
  );
  assert.equal(validateQuestionDraft(draft).length, 0);

  const serialized = questionDraftToEditorSlide(draft);
  assert.equal(serialized.question.evaluation_mode, "none");
  assert.equal(serialized.question.scoring_mode, "none");
  assert.equal(serialized.question.min_point, 0);
  assert.equal(serialized.question.max_point, 0);
  assert.equal(serialized.show_leaderboard_after, false);
});

test("draft validation mirrors backend timing, scoring, option and unicode limits", () => {
  const draft = createQuestionDraft(slide);
  assert.ok(draft);

  const invalidTime = { ...draft, timeInput: "۰" };
  assert.match(validateQuestionDraft(invalidTime)[0]?.message || "", /زمان/);

  const invalidPoints = { ...draft, minPointsInput: "۱۰۱", maxPointsInput: "۱۰۰" };
  assert.ok(validateQuestionDraft(invalidPoints).some((issue) => issue.field === "points"));

  const emptyOption = {
    ...draft,
    options: draft.options.map((option, index) =>
      index === 0 ? { ...option, text: "" } : option,
    ),
  };
  assert.ok(validateQuestionDraft(emptyOption).some((issue) => issue.field === "option_text"));

  const longPersianText = { ...draft, text: "س".repeat(10_001) };
  assert.ok(validateQuestionDraft(longPersianText).some((issue) => issue.code === "question_text_too_long"));
});
