import test from "node:test";
import assert from "node:assert/strict";

import {
  flushQueuedParticipantAnswers,
  queueParticipantAnswer,
  readQueuedParticipantAnswers,
  writeQueuedParticipantAnswers,
} from "../src/modules/live/participant/answerQueue.ts";

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
};

test("participant answer queue preserves a stable request id", () => {
  const storage = createMemoryStorage();
  const answer = {
    request_id: "request-1",
    question_id: "q1",
    selected_option_indexes: [0, 2],
    user_id: "user-1",
    run_id: 7,
  };

  queueParticipantAnswer("room-1", answer, storage);
  queueParticipantAnswer("room-1", answer, storage);

  const queued = readQueuedParticipantAnswers("room-1", storage);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].request_id, "request-1");
  assert.deepEqual(queued[0].selected_option_indexes, [0, 2]);
});

test("v2 queue entries migrate to typed selected indexes", () => {
  const storage = createMemoryStorage();
  storage.setItem(
    "presentation_answer_queue_v2:room-1",
    JSON.stringify([
      {
        request_id: "legacy-request",
        question_id: "q1",
        user_id: "user-1",
        run_id: 3,
        options_result: [
          { option_id: 0, picked: false },
          { option_id: 1, picked: true },
        ],
      },
    ]),
  );

  const queued = readQueuedParticipantAnswers("room-1", storage);
  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0].selected_option_indexes, [1]);
  assert.equal(storage.getItem("presentation_answer_queue_v2:room-1"), null);
});

test("flush sends only the current participant queue", async () => {
  const storage = createMemoryStorage();
  writeQueuedParticipantAnswers(
    "room-1",
    [
      {
        request_id: "mine",
        question_id: "q1",
        selected_option_indexes: [0],
        user_id: "user-1",
        run_id: 4,
      },
      {
        request_id: "other",
        question_id: "q1",
        selected_option_indexes: [1],
        user_id: "user-2",
        run_id: 4,
      },
    ],
    storage,
  );

  const submitted = [];
  const result = await flushQueuedParticipantAnswers(
    "room-1",
    "q1",
    4,
    "user-1",
    async (answer) => {
      submitted.push(answer);
      return true;
    },
    storage,
  );

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].request_id, "mine");
  assert.deepEqual(result.sentKeys, ["user-1:q1:4"]);
  assert.equal(readQueuedParticipantAnswers("room-1", storage).length, 0);
});

test("failed transport keeps the current participant answer queued", async () => {
  const storage = createMemoryStorage();
  queueParticipantAnswer(
    "room-1",
    {
      request_id: "request-1",
      question_id: "q1",
      selected_option_indexes: [0],
      user_id: "user-1",
      run_id: 5,
    },
    storage,
  );

  const result = await flushQueuedParticipantAnswers(
    "room-1",
    "q1",
    5,
    "user-1",
    async () => false,
    storage,
  );

  assert.equal(result.remaining, 1);
  assert.equal(readQueuedParticipantAnswers("room-1", storage)[0].request_id, "request-1");
});
