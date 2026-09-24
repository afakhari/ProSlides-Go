import test from "node:test";
import assert from "node:assert/strict";

import {
  readParticipantAnswerReceipt,
  writeParticipantAnswerReceipt,
} from "../src/modules/live/participant/answerReceipt.ts";

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
};

test("participant receipt is isolated by room and question run", () => {
  const storage = createMemoryStorage();
  writeParticipantAnswerReceipt(
    "room-1",
    {
      question_id: "q1",
      run_id: 7,
      selected_option_indexes: [1],
      request_id: "request-1",
      status: "sent",
      updated_at: 1,
    },
    storage,
  );

  assert.equal(
    readParticipantAnswerReceipt("room-1", "q1", 7, storage)?.status,
    "sent",
  );
  assert.equal(readParticipantAnswerReceipt("room-1", "q1", 8, storage), null);
  assert.equal(readParticipantAnswerReceipt("room-2", "q1", 7, storage), null);
});

test("new question receipt replaces the previous room receipt", () => {
  const storage = createMemoryStorage();
  writeParticipantAnswerReceipt(
    "room-1",
    {
      question_id: "q1",
      run_id: 1,
      selected_option_indexes: [0],
      request_id: "request-1",
      status: "sent",
      updated_at: 1,
    },
    storage,
  );
  writeParticipantAnswerReceipt(
    "room-1",
    {
      question_id: "q2",
      run_id: 2,
      selected_option_indexes: [1],
      request_id: "request-2",
      status: "queued",
      updated_at: 2,
    },
    storage,
  );

  assert.equal(readParticipantAnswerReceipt("room-1", "q1", 1, storage), null);
  assert.equal(
    readParticipantAnswerReceipt("room-1", "q2", 2, storage)?.request_id,
    "request-2",
  );
});
