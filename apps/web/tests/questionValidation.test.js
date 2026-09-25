import test from "node:test";
import assert from "node:assert/strict";

import {
  getContentValidationError,
  getQuestionValidationError,
} from "../src/modules/presentations/model/editor.ts";
import {
  getPresentationValidationError,
} from "../src/modules/presentations/model/itemRegistry.ts";

const validQuestion = {
  question_text: "Choose",
  question_type: "multiple",
  question_time: 30,
  min_point: 0,
  max_point: 100,
  options: [
    { option_id: "a", text: "A", is_correct: true },
    { option_id: "b", text: "B", is_correct: false },
  ],
};

test("accepts a complete question", () => {
  assert.equal(getQuestionValidationError(validQuestion), null);
});

test("rejects invalid scoring and timing ranges", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, question_time: 0 }), /زمان/i);
  assert.match(getQuestionValidationError({ ...validQuestion, min_point: 101 }), /امتیاز/i);
  assert.match(getQuestionValidationError({ ...validQuestion, max_point: 0 }), /امتیاز/i);
});

test("rejects incomplete and inconsistent options", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, options: [{ text: "A", is_correct: true }] }), /دو گزینه/i);
  assert.match(getQuestionValidationError({ ...validQuestion, question_type: "single", options: validQuestion.options.map((option) => ({ ...option, is_correct: true })) }), /یک گزینه صحیح/i);
});

test("rejects duplicate option identities and single-choice partial scoring", () => {
  assert.match(getQuestionValidationError({
    ...validQuestion,
    options: validQuestion.options.map((option) => ({ ...option, option_id: "same" })),
  }), /یکت/i);
  assert.match(getQuestionValidationError({
    ...validQuestion,
    question_type: "single",
    partial_scoring: true,
  }), /جزئی/i);
});

test("presentation validation is shared by editor and dashboard present actions", () => {
  assert.match(getPresentationValidationError({ slides: [] }), /حداقل یک اسلاید/i);
  const choice = {
    item_kind: "activity",
    activity_kind: "choice",
    schema_version: 1,
    show_leaderboard_after: false,
    question: validQuestion,
  };
  assert.equal(getPresentationValidationError({ slides: [choice] }), null);
  assert.match(getPresentationValidationError({
    slides: [{ ...choice, question: { ...validQuestion, question_time: 0 } }],
  }), /زمان/i);
  assert.match(getPresentationValidationError({
    slides: [{
      item_kind: "content",
      title: "",
      content_text: "",
      content_image_url: "",
    }],
  }), /عنوان، متن یا تصویر/i);
  assert.equal(getPresentationValidationError({
    slides: [{
      item_kind: "content",
      title: "Introduction",
      content_text: "",
      content_image_url: "",
    }],
  }), null);
});


test("content validation shares the editor contract and unicode limits", () => {
  assert.match(
    getContentValidationError({ title: "", content_text: "", content_image_url: "" }),
    /عنوان، متن یا تصویر/i,
  );
  assert.equal(
    getContentValidationError({ title: "ع".repeat(500), content_text: "م".repeat(20_000) }),
    null,
  );
  assert.match(
    getContentValidationError({ title: "ع".repeat(501) }),
    /عنوان/i,
  );
});
