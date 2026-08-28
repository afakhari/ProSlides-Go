import test from "node:test";
import assert from "node:assert/strict";

import { getPresentationValidationError, getQuestionValidationError } from "../src/modules/presentations/editor/model/validation.js";

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
  assert.match(getQuestionValidationError({ ...validQuestion, question_time: 0 }), /time/i);
  assert.match(getQuestionValidationError({ ...validQuestion, min_point: 101 }), /points/i);
  assert.match(getQuestionValidationError({ ...validQuestion, max_point: 0 }), /points/i);
});

test("rejects incomplete and inconsistent options", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, options: [{ text: "A", is_correct: true }] }), /two options/i);
  assert.match(getQuestionValidationError({ ...validQuestion, question_type: "single", options: validQuestion.options.map((option) => ({ ...option, is_correct: true })) }), /exactly one/i);
});

test("rejects duplicate option identities and single-choice partial scoring", () => {
  assert.match(getQuestionValidationError({
    ...validQuestion,
    options: validQuestion.options.map((option) => ({ ...option, option_id: "same" })),
  }), /unique identifier/i);
  assert.match(getQuestionValidationError({
    ...validQuestion,
    question_type: "single",
    partial_scoring: true,
  }), /partial scoring/i);
});

test("presentation validation is shared by editor and dashboard present actions", () => {
  assert.match(getPresentationValidationError({ slides: [] }), /at least one slide/i);
  assert.equal(getPresentationValidationError({ slides: [{ slide_type: 1, question: validQuestion }] }), null);
  assert.match(getPresentationValidationError({
    slides: [{ slide_type: 1, question: { ...validQuestion, question_time: 0 } }],
  }), /time/i);
  assert.match(getPresentationValidationError({
    slides: [{ slide_type: 2, title: "", content_text: "", content_image_url: "" }],
  }), /content slide/i);
  assert.equal(getPresentationValidationError({
    slides: [{ slide_type: 2, title: "Introduction", content_text: "", content_image_url: "" }],
  }), null);
});
