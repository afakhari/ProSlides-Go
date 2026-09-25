import assert from "node:assert/strict";
import test from "node:test";

import {
  appendPresentationSlide,
  convertSlideToContent,
  convertSlideToQuestion,
  createSlideForChoice,
  activeSlideIdAfterDeletion,
  removePresentationSlide,
  replacePresentationSlide,
} from "../src/modules/presentations/editor/model/slideMutations.ts";

const idFactory = (...ids) => {
  let index = 0;
  return () => ids[index++] ?? `generated-${index}`;
};

const questionSlide = {
  slide_id: "slide-1",
  revision: 4,
  order: 0,
  item_kind: "activity",
  activity_kind: "choice",
  schema_version: 1,
  show_leaderboard_after: true,
  title: "",
  content_text: "",
  content_image_url: "",
  question: {
    question_id: "slide-1",
    title: "",
    text: "سؤال",
    question_text: "سؤال",
    question_type: "multiple",
    min_point: 0,
    max_point: 100,
    time_limit: 20,
    question_time: 20,
    image_url: "",
    question_image: "",
    faster_answers_more_points: false,
    partial_scoring: true,
    options: [
      { option_id: "a", text: "الف", is_correct: true, image_url: "", order: 1 },
      { option_id: "b", text: "ب", is_correct: true, image_url: "", order: 2 },
      { option_id: "c", text: "ج", is_correct: false, image_url: "", order: 3 },
    ],
  },
};

test("new slide creation stays type-first and creates valid defaults", () => {
  const content = createSlideForChoice(
    3,
    "Content Slide",
    idFactory("content-id"),
  );
  assert.equal(content.slide_id, "content-id");
  assert.equal(content.item_kind, "content");
  assert.equal(content.question, null);
  assert.equal(content.order, 3);

  const question = createSlideForChoice(
    4,
    "Single Choice",
    idFactory("question-id", "option-1", "option-2"),
  );
  assert.equal(question.item_kind, "activity");
  assert.equal(question.activity_kind, "choice");
  assert.equal(question.question?.question_type, "single");
  assert.deepEqual(
    question.question?.options.map((option) => [
      option.option_id,
      option.is_correct,
      option.order,
    ]),
    [
      ["option-1", true, 1],
      ["option-2", false, 2],
    ],
  );
});

test("multiple to single conversion preserves content and exactly one correct option", () => {
  const converted = convertSlideToQuestion(
    questionSlide,
    "single",
    idFactory("unused"),
  );

  assert.equal(converted.revision, questionSlide.revision);
  assert.equal(converted.question?.question_type, "single");
  assert.equal(converted.question?.partial_scoring, false);
  assert.deepEqual(
    converted.question?.options.map((option) => option.is_correct),
    [true, false, false],
  );
  assert.deepEqual(
    converted.question?.options.map((option) => option.order),
    [1, 2, 3],
  );
});

test("question conversion repairs missing options and missing correct answers", () => {
  const incomplete = {
    ...questionSlide,
    question: {
      ...questionSlide.question,
      question_type: "single",
      partial_scoring: false,
      options: [
        {
          option_id: "a",
          text: "الف",
          is_correct: false,
          image_url: "",
          order: 8,
        },
      ],
    },
  };

  const converted = convertSlideToQuestion(
    incomplete,
    "multiple",
    idFactory("option-2"),
  );

  assert.equal(converted.question?.options.length, 2);
  assert.equal(converted.question?.options[0].is_correct, true);
  assert.deepEqual(
    converted.question?.options.map((option) => option.order),
    [1, 2],
  );
});

test("content conversion removes question-only state and leaderboard follow-up", () => {
  const converted = convertSlideToContent(questionSlide);

  assert.equal(converted.item_kind, "content");
  assert.equal(converted.question, null);
  assert.equal(converted.show_leaderboard_after, false);
  assert.equal(converted.title, "اسلاید محتوایی جدید");
});

test("presentation helpers keep revision and active-neighbor semantics deterministic", () => {
  const second = { ...questionSlide, slide_id: "slide-2", order: 1 };
  const third = { ...questionSlide, slide_id: "slide-3", order: 2 };
  const presentation = {
    quiz_id: "presentation-1",
    revision: 8,
    access_code: "",
    title: "ارائه",
    quiz_name: "ارائه",
    background_color: "#ffffff",
    background_image_url: "",
    text_color: "#111827",
    music_url: "",
    background: { color: "#ffffff", image: "", text_color: "#111827" },
    slides: [questionSlide, second, third],
    created_at: "",
    last_update: "",
  };

  assert.equal(
    activeSlideIdAfterDeletion(
      presentation.slides,
      "slide-2",
      "slide-1",
    ),
    "slide-1",
  );
  assert.equal(
    activeSlideIdAfterDeletion(
      presentation.slides,
      "slide-2",
      "slide-2",
    ),
    "slide-3",
  );
  assert.equal(
    activeSlideIdAfterDeletion(
      presentation.slides,
      "slide-3",
      "slide-3",
    ),
    "slide-2",
  );

  const replacement = { ...second, title: "به‌روز" };
  const replaced = replacePresentationSlide(presentation, replacement);
  assert.equal(replaced.revision, 9);
  assert.equal(replaced.slides[1].title, "به‌روز");

  const appended = appendPresentationSlide(presentation, {
    ...third,
    slide_id: "slide-4",
    order: 3,
  });
  assert.equal(appended.revision, 9);
  assert.equal(appended.slides.at(-1)?.slide_id, "slide-4");

  const removed = removePresentationSlide(presentation, "slide-2");
  assert.equal(removed.revision, 9);
  assert.deepEqual(
    removed.slides.map((slide) => slide.slide_id),
    ["slide-1", "slide-3"],
  );
});
