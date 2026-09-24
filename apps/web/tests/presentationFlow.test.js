import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PRESENTATION,
  findContentSlideIndex,
  findLeaderboardSlideIndex,
  findQuestionSlideIndex,
  isContentSlide,
  isLeaderboardSlide,
  isQuestionSlide,
  persistPlayerLastActive,
  persistPlayerSeenActive,
  readPlayerLastActive,
  readPlayerSeenActive,
} from "../src/modules/live/model/presentationFlow.ts";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
};

test("presentation flow classifies question content and leaderboard slides explicitly", () => {
  assert.equal(isQuestionSlide({ slide_type: 1, question_id: "q1" }), true);
  assert.equal(isContentSlide({ slide_type: 2, title: "راهنما" }), true);
  assert.equal(isLeaderboardSlide({ slide_type: 3 }), true);
  assert.equal(isLeaderboardSlide({ slide_type: 2 }), true);
  assert.equal(
    isLeaderboardSlide({ slide_type: 2, content_text: "توضیح" }),
    false,
  );
});

test("player resume storage is scoped per room and validates persisted payloads", () => {
  const session = memoryStorage();
  const local = memoryStorage();

  assert.equal(readPlayerSeenActive("room-a", session), false);
  persistPlayerSeenActive("room-a", session);
  assert.equal(readPlayerSeenActive("room-a", session), true);
  assert.equal(readPlayerSeenActive("room-b", session), false);

  persistPlayerLastActive(
    "room-a",
    {
      kind: "question",
      payload: {
        slide_type: 1,
        question_id: "q1",
        question_text: "سؤال",
      },
      updatedAt: 123,
    },
    local,
  );

  assert.deepEqual(readPlayerLastActive("room-a", local), {
    kind: "question",
    payload: {
      slide_type: 1,
      question_id: "q1",
      question_text: "سؤال",
    },
    updatedAt: 123,
  });
  assert.equal(readPlayerLastActive("room-b", local), null);
});

test("empty presentation model keeps a safe stable fallback shape", () => {
  assert.equal(EMPTY_PRESENTATION.quiz_id, "");
  assert.deepEqual(EMPTY_PRESENTATION.slides, []);
  assert.equal(EMPTY_PRESENTATION.background.color, "#1e1e2e");
});

test("manager reconciliation helpers locate authoritative question content and leaderboard slides", () => {
  const slides = [
    {
      slide_type: 1,
      slide_id: "q1",
      question_id: "q1",
      order: 1,
    },
    {
      slide_type: 2,
      slide_id: "lb1",
      order: 1,
    },
    {
      slide_type: 2,
      slide_id: "c1",
      order: 2,
      title: "توضیح",
    },
  ];

  assert.equal(findQuestionSlideIndex(slides, "q1"), 0);
  assert.equal(
    findContentSlideIndex(slides, {
      slide_type: 2,
      slide_id: "c1",
      order: 2,
      title: "توضیح",
    }),
    2,
  );
  assert.equal(
    findLeaderboardSlideIndex({
      slides,
      currentSlide: 1,
      lastQuestionSlideIndex: 0,
    }),
    1,
  );
});

test("manager leaderboard reconciliation falls back to current or next known leaderboard", () => {
  const slides = [
    {
      slide_type: 2,
      slide_id: "content",
      order: 1,
      title: "مطلب",
    },
    {
      slide_type: 3,
      slide_id: "leaderboard",
      order: 2,
    },
  ];

  assert.equal(
    findLeaderboardSlideIndex({
      slides,
      currentSlide: 2,
      lastQuestionSlideIndex: null,
    }),
    1,
  );
});
