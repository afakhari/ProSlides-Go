import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParticipantAnswer,
  isMultipleChoiceQuestion,
  questionRunIdentity,
  toggleParticipantOption,
} from "../src/modules/live/participant/answerAttempt.ts";
import {
  clearAnswerDraft,
  clearPendingAnswer,
  readAnswerDraft,
  readPendingAnswer,
  saveAnswerDraft,
  savePendingAnswer,
} from "../src/modules/live/participant/pendingAnswerStorage.ts";

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


test("pending live answers preserve the same request id across a refresh boundary", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const values = new Map();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  });

  try {
    const answer = {
      request_id: "11111111-1111-4111-8111-111111111111",
      activity_item_id: "activity-1",
      response: { selected_option_indexes: [0, 2] },
    };

    savePendingAnswer("room-1", "activity-1:run-7", answer);
    assert.deepEqual(
      readPendingAnswer("room-1", "activity-1:run-7"),
      answer,
    );

    clearPendingAnswer("room-1", "activity-1:run-7");
    assert.equal(
      readPendingAnswer("room-1", "activity-1:run-7"),
      null,
    );
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "sessionStorage", originalDescriptor);
    } else {
      delete globalThis.sessionStorage;
    }
  }
});


test("unsent live drafts survive a same-tab refresh boundary", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const values = new Map();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  });

  try {
    saveAnswerDraft("room-1", "activity-1:run-7", {
      selectedIndexes: [1, 3],
    });
    assert.deepEqual(
      readAnswerDraft("room-1", "activity-1:run-7"),
      { selectedIndexes: [1, 3] },
    );

    saveAnswerDraft("room-1", "cloud-1:run-2", {
      text: "پاسخ ناتمام من",
    });
    assert.deepEqual(
      readAnswerDraft("room-1", "cloud-1:run-2"),
      { text: "پاسخ ناتمام من" },
    );

    clearAnswerDraft("room-1", "activity-1:run-7");
    assert.equal(
      readAnswerDraft("room-1", "activity-1:run-7"),
      null,
    );
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "sessionStorage", originalDescriptor);
    } else {
      delete globalThis.sessionStorage;
    }
  }
});
