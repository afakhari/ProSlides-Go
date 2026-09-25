import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParticipantAnswer,
  isMultipleChoiceQuestion,
  questionRunIdentity,
  toggleParticipantOption,
} from "../src/modules/live/participant/answerAttempt.ts";

test("participant option selection stays index-based across object recreation", () => {
  assert.deepEqual(toggleParticipantOption([], 1, false), [1]);
  assert.deepEqual(toggleParticipantOption([1], 1, false), []);
  assert.deepEqual(toggleParticipantOption([0], 1, false), [1]);

  assert.deepEqual(toggleParticipantOption([], 1, true), [1]);
  assert.deepEqual(toggleParticipantOption([1], 0, true), [0, 1]);
  assert.deepEqual(toggleParticipantOption([0, 1], 1, true), [0]);
});

test("participant answer payload uses stable option indexes, not option ids", () => {
  const question = {
    item_kind: "activity",
    question_id: "11111111-1111-4111-8111-111111111111",
    run_id: 7,
    options: [
      {
        option_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        option_index: 0,
        option_text: "اول",
      },
      {
        option_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        option_index: 1,
        option_text: "دوم",
      },
    ],
  };

  assert.deepEqual(
    buildParticipantAnswer({
      question,
      selectedIndexes: [1],
      requestId: "22222222-2222-4222-8222-222222222222",
    }),
    {
      request_id: "22222222-2222-4222-8222-222222222222",
      activity_item_id: "11111111-1111-4111-8111-111111111111",
      response: {
        selected_option_indexes: [1],
      },
    },
  );
});

test("participant question run identity changes only when question or run changes", () => {
  assert.equal(
    questionRunIdentity({
      item_kind: "activity",
      question_id: "q1",
      run_id: 9,
    }),
    "q1:9",
  );
  assert.equal(
    questionRunIdentity({
      item_kind: "activity",
      question_id: "q1",
    }),
    "q1:na",
  );
  assert.equal(questionRunIdentity(null), null);
});


test("participant question multiplicity follows explicit server question type", () => {
  assert.equal(
    isMultipleChoiceQuestion({
      item_kind: "activity",
      question_type: "single",
    }),
    false,
  );
  assert.equal(
    isMultipleChoiceQuestion({
      item_kind: "activity",
      question_type: "multiple",
    }),
    true,
  );
  assert.equal(
    isMultipleChoiceQuestion({
      item_kind: "activity",
      question_type: "single",
      has_multiple: true,
    }),
    true,
  );
});

test("participant answer builder rejects indexes outside the projected options", () => {
  assert.equal(
    buildParticipantAnswer({
      question: {
        item_kind: "activity",
        question_id: "q1",
        options: [{ option_id: 0, option_index: 0, option_text: "الف" }],
      },
      selectedIndexes: [4],
      requestId: "req",
    }),
    null,
  );
});
