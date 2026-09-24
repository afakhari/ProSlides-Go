import test from "node:test";
import assert from "node:assert/strict";
import { resolveQuestionTimer } from "../src/modules/live/model/questionTimer.ts";

const createStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
};

test("timer state is stored per identity and not clobbered by temporary identity", () => {
  globalThis.localStorage = createStorage();

  const roomId = "33";
  const role = "manager";

  const first = resolveQuestionTimer({
    question: {
      question_id: 10,
      run_id: 500,
      question_time: 20,
      remaining_seconds: 18,
    },
    roomId,
    role,
    nowMs: 100000,
  });
  assert.equal(Math.round(first.remainingSeconds), 18);

  // Temporary question identity without run_id should not destroy the run-scoped timer state.
  resolveQuestionTimer({
    question: {
      question_id: 10,
      question_time: 20,
    },
    roomId,
    role,
    nowMs: 101000,
  });

  const resumed = resolveQuestionTimer({
    question: {
      question_id: 10,
      run_id: 500,
      question_time: 20,
    },
    roomId,
    role,
    nowMs: 101000,
  });

  assert.equal(resumed.totalSeconds, 20);
  assert.equal(resumed.remainingSeconds < 20, true);
  assert.equal(resumed.remainingSeconds > 0, true);
});

test("timer without run_id reuses latest question timer anchor", () => {
  globalThis.localStorage = createStorage();

  const roomId = "33";
  const role = "manager";

  const seeded = resolveQuestionTimer({
    question: {
      question_id: 22,
      run_id: 900,
      question_time: 30,
      remaining_seconds: 24,
    },
    roomId,
    role,
    nowMs: 200000,
  });
  assert.equal(Math.round(seeded.remainingSeconds), 24);

  // Simulate refresh payload that lost run_id but still references same question.
  const resumedWithoutRunId = resolveQuestionTimer({
    question: {
      question_id: 22,
      question_time: 30,
    },
    roomId,
    role,
    nowMs: 201000,
  });

  assert.equal(resumedWithoutRunId.identity, "22:na");
  assert.equal(resumedWithoutRunId.remainingSeconds < 30, true);
  assert.equal(resumedWithoutRunId.remainingSeconds > 0, true);
});

test("a reconnected player anchors on the server-computed remaining_seconds even on a skewed client clock", () => {
  globalThis.localStorage = createStorage();

  const roomId = "44";
  const role = "player";
  const questionTime = 30;
  const nowMs = 7_000_000_000;

  // Reconnect mid-question: the server deadline is minutes away and the client
  // clock is far behind, so a pure ends_at - Date.now() derivation would wrongly
  // suggest a near-full timer. The server remaining_seconds must win instead.
  const resolved = resolveQuestionTimer({
    question: {
      question_id: 55,
      run_id: 321,
      question_time: questionTime,
      remaining_seconds: 11,
      started_at: new Date(nowMs - 5_000_000).toISOString(),
    },
    roomId,
    role,
    nowMs,
  });

  assert.equal(resolved.totalSeconds, questionTime);
  assert.equal(resolved.remainingSeconds, 11);
  assert.equal(
    resolved.anchorStartMs,
    nowMs - (questionTime - 11) * 1000,
  );
});
