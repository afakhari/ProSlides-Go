import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParticipantAnswer,
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
    slide_type: 1,
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
      question_id: "11111111-1111-4111-8111-111111111111",
      options_result: [
        { option_index: 0, picked: false },
        { option_index: 1, picked: true },
      ],
    },
  );
});

test("participant question run identity changes only when question or run changes", () => {
  assert.equal(
    questionRunIdentity({
      slide_type: 1,
      question_id: "q1",
      run_id: 9,
    }),
    "q1:9",
  );
  assert.equal(
    questionRunIdentity({
      slide_type: 1,
      question_id: "q1",
    }),
    "q1:na",
  );
  assert.equal(questionRunIdentity(null), null);
});
