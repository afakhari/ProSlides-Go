import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSlideListItems,
  getSlideListTitle,
  getSlideListTypeLabel,
  presentationAfterReorder,
  reorderEditorSlides,
} from "../src/modules/presentations/editor/model/slideListModel.ts";
import {
  getEditorItemBehaviors,
} from "../src/modules/presentations/model/itemRegistry.ts";

const question = {
  slide_id: "question-1",
  revision: 4,
  order: 0,
  item_kind: "activity",
  activity_kind: "choice",
  schema_version: 1,
  show_leaderboard_after: true,
  question: {
    question_id: "question-1",
    title: "",
    text: "سؤال نمونه",
    question_text: "سؤال نمونه",
    question_type: "single",
    time_limit: 10,
    question_time: 10,
    min_point: 0,
    max_point: 100,
    image_url: "",
    question_image: "",
    faster_answers_more_points: false,
    partial_scoring: false,
    options: [
      { option_id: "a", text: "الف", is_correct: true, image_url: "", order: 1 },
      { option_id: "b", text: "ب", is_correct: false, image_url: "", order: 2 },
    ],
  },
};

const content = {
  slide_id: "content-1",
  revision: 7,
  order: 1,
  item_kind: "content",
  show_leaderboard_after: false,
  question: null,
  title: "محتوا",
  content_text: "متن",
  content_image_url: "",
};

test("item rail contains only persisted items and keeps post-Activity flow as metadata", () => {
  const items = buildSlideListItems([question, content]);

  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.slide_id),
    ["question-1", "content-1"],
  );
  assert.equal(getSlideListTitle(items[0]), "سؤال نمونه");
  assert.equal(getSlideListTypeLabel(items[0]), "تک‌گزینه‌ای");
  assert.deepEqual(
    getEditorItemBehaviors(items[0]).map((behavior) => behavior.id),
    ["activity-result", "overall-ranking"],
  );
  assert.deepEqual(getEditorItemBehaviors(items[1]), []);
});

test("reorder normalizes positions without mutating input", () => {
  const slides = [question, content];
  const reordered = reorderEditorSlides(slides, 0, 1);

  assert.notEqual(reordered, slides);
  assert.deepEqual(
    reordered.map((slide) => [slide.slide_id, slide.order]),
    [
      ["content-1", 0],
      ["question-1", 1],
    ],
  );
  assert.deepEqual(
    slides.map((slide) => [slide.slide_id, slide.order]),
    [
      ["question-1", 0],
      ["content-1", 1],
    ],
  );
});

test("successful reorder mirrors backend presentation and slide revision increments", () => {
  const presentation = {
    quiz_id: "presentation-1",
    revision: 10,
    access_code: "",
    title: "ارائه",
    quiz_name: "ارائه",
    background_color: "#ffffff",
    background_image_url: "",
    text_color: "#111827",
    music_url: "",
    background: { color: "#ffffff", image: "", text_color: "#111827" },
    slides: [question, content],
    created_at: "",
    last_update: "",
  };
  const reordered = reorderEditorSlides(presentation.slides, 1, 0);
  const committed = presentationAfterReorder(presentation, reordered);

  assert.equal(committed.revision, 11);
  assert.deepEqual(
    committed.slides.map((slide) => [
      slide.slide_id,
      slide.order,
      slide.revision,
    ]),
    [
      ["content-1", 0, 8],
      ["question-1", 1, 5],
    ],
  );
});

test("invalid or no-op reorder keeps the same array identity", () => {
  const slides = [question, content];

  assert.equal(reorderEditorSlides(slides, 0, 0), slides);
  assert.equal(reorderEditorSlides(slides, -1, 1), slides);
  assert.equal(reorderEditorSlides(slides, 0, 4), slides);
});
