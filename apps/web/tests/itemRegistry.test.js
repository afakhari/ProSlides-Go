import assert from "node:assert/strict";
import test from "node:test";

import {
  activityRegistry,
  contentRegistry,
  editorTypeChoices,
  getEditorItemBehaviors,
  getEditorItemTypeLabel,
  getPresentationValidationError,
  resolveEditorItemRegistration,
} from "../src/modules/presentations/model/itemRegistry.ts";
import {
  convertEditorSlideToType,
  createEditorSlideForType,
  editorSlideMatchesTypeChoice,
  getEditorConversionConfirmation,
} from "../src/modules/presentations/editor/registry/editorItemRegistry.ts";

const createIdSequence = (...ids) => {
  let index = 0;
  return () => ids[index++] ?? `generated-${index}`;
};

const choiceSlide = {
  slide_id: "choice-1",
  revision: 3,
  order: 0,
  slide_type: 1,
  item_kind: "activity",
  activity_kind: "choice",
  schema_version: 1,
  show_leaderboard_after: true,
  question: {
    question_id: "choice-1",
    title: "",
    text: "یک گزینه را انتخاب کنید",
    question_text: "یک گزینه را انتخاب کنید",
    question_type: "multiple",
    time_limit: 30,
    question_time: 30,
    min_point: 0,
    max_point: 100,
    image_url: "",
    question_image: "",
    faster_answers_more_points: false,
    partial_scoring: true,
    options: [
      { option_id: "a", text: "الف", is_correct: true, image_url: "", order: 1 },
      { option_id: "b", text: "ب", is_correct: true, image_url: "", order: 2 },
    ],
  },
};

const contentSlide = {
  slide_id: "content-1",
  revision: 2,
  order: 1,
  slide_type: 2,
  item_kind: "content",
  show_leaderboard_after: false,
  question: null,
  title: "مقدمه",
  content_text: "",
  content_image_url: "",
};

test("content and Activity registries stay bounded and authoring choices exclude leaderboard pseudo-items", () => {
  assert.deepEqual(contentRegistry.map((entry) => entry.key), ["content"]);
  assert.deepEqual(activityRegistry.map((entry) => entry.key), ["choice"]);
  assert.deepEqual(
    editorTypeChoices.map((choice) => choice.id),
    ["poll", "choice-single", "choice-multiple", "content"],
  );
  assert.equal(
    editorTypeChoices.some((choice) => /leaderboard|ranking/i.test(choice.id)),
    false,
  );
});

test("Choice registration does not capture future Activity kinds", () => {
  const futureActivity = {
    ...choiceSlide,
    activity_kind: "text",
  };

  assert.equal(resolveEditorItemRegistration(futureActivity), null);
});

test("Choice registration exposes Activity result and optional overall ranking as separate behaviors", () => {
  assert.equal(resolveEditorItemRegistration(choiceSlide)?.key, "choice");
  assert.equal(getEditorItemTypeLabel(choiceSlide), "چندگزینه‌ای");
  assert.deepEqual(
    getEditorItemBehaviors(choiceSlide).map((behavior) => behavior.id),
    ["activity-result", "overall-ranking"],
  );

  const withoutRanking = {
    ...choiceSlide,
    show_leaderboard_after: false,
  };
  assert.deepEqual(
    getEditorItemBehaviors(withoutRanking).map((behavior) => behavior.id),
    ["activity-result"],
  );
});

test("registry creates and converts editor items without top-level route knowledge", () => {
  const created = createEditorSlideForType(
    2,
    "choice-single",
    createIdSequence("slide-new", "option-a", "option-b"),
  );
  assert.equal(created.slide_type, 1);
  assert.equal(created.question.question_type, "single");
  assert.equal(created.question.options.length, 2);

  const converted = convertEditorSlideToType(
    contentSlide,
    "choice-multiple",
    createIdSequence("option-a", "option-b"),
  );
  assert.equal(converted.slide_id, contentSlide.slide_id);
  assert.equal(converted.slide_type, 1);
  assert.equal(converted.question.question_type, "multiple");
  assert.equal(editorSlideMatchesTypeChoice(converted, "choice-multiple"), true);
  assert.match(
    getEditorConversionConfirmation(contentSlide, "choice-single").title,
    /فعالیت انتخابی/,
  );
});

test("Poll stays a Choice preset while removing correctness, score, and ranking", () => {
  const poll = createEditorSlideForType(
    2,
    "poll",
    createIdSequence("poll-1", "option-a", "option-b"),
  );

  assert.equal(poll.activity_kind, "choice");
  assert.equal(poll.schema_version, 1);
  assert.equal(poll.question.question_type, "single");
  assert.equal(poll.question.evaluation_mode, "none");
  assert.equal(poll.question.scoring_mode, "none");
  assert.equal(poll.question.min_point, 0);
  assert.equal(poll.question.max_point, 0);
  assert.deepEqual(
    poll.question.options.map((option) => option.is_correct),
    [false, false],
  );
  assert.equal(poll.show_leaderboard_after, false);
  assert.equal(editorSlideMatchesTypeChoice(poll, "poll"), true);
  assert.equal(getEditorItemTypeLabel(poll), "نظرسنجی");

  const converted = convertEditorSlideToType(
    choiceSlide,
    "poll",
    createIdSequence(),
  );
  assert.equal(converted.question.question_type, "single");
  assert.equal(converted.question.evaluation_mode, "none");
  assert.equal(converted.question.scoring_mode, "none");
  assert.equal(converted.show_leaderboard_after, false);
  assert.deepEqual(
    converted.question.options.map((option) => option.is_correct),
    [false, false],
  );
  assert.match(
    getEditorConversionConfirmation(choiceSlide, "poll").description,
    /پاسخ صحیح.*امتیازدهی.*رتبه‌بندی/,
  );

  const quizAgain = convertEditorSlideToType(
    converted,
    "choice-single",
    createIdSequence(),
  );
  assert.equal(quizAgain.question.evaluation_mode, "correctness");
  assert.equal(quizAgain.question.scoring_mode, "points");
  assert.equal(quizAgain.question.max_point, 100);
  assert.deepEqual(
    quizAgain.question.options.map((option) => option.is_correct),
    [true, false],
  );
  assert.equal(editorSlideMatchesTypeChoice(quizAgain, "choice-single"), true);
});

test("presentation validation resolves through item registrations", () => {
  assert.equal(
    getPresentationValidationError({ slides: [choiceSlide, contentSlide] }),
    null,
  );
  assert.match(
    getPresentationValidationError({
      slides: [{
        ...choiceSlide,
        question: { ...choiceSlide.question, question_time: 0 },
      }],
    }),
    /زمان/,
  );
});
