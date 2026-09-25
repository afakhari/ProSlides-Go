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

test("presentation flow classifies live items by explicit item kind", () => {
  assert.equal(isQuestionSlide({ item_kind: "activity", question_id: "q1" }), true);
  assert.equal(isContentSlide({ item_kind: "content", title: "راهنما" }), true);
  assert.equal(isLeaderboardSlide({ item_kind: "legacy-leaderboard" }), true);
  assert.equal(isLeaderboardSlide({ item_kind: "content" }), false);
  assert.equal(
    isLeaderboardSlide({ item_kind: "content", content_text: "توضیح" }),
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
        item_kind: "activity",
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
      item_kind: "activity",
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
      item_kind: "activity",
      slide_id: "q1",
      question_id: "q1",
      order: 1,
    },
    {
      item_kind: "legacy-leaderboard",
      slide_id: "lb1",
      order: 1,
    },
    {
      item_kind: "content",
      slide_id: "c1",
      order: 2,
      title: "توضیح",
    },
  ];

  assert.equal(findQuestionSlideIndex(slides, "q1"), 0);
  assert.equal(
    findContentSlideIndex(slides, {
      item_kind: "content",
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
      item_kind: "content",
      slide_id: "content",
      order: 1,
      title: "مطلب",
    },
    {
      item_kind: "legacy-leaderboard",
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
