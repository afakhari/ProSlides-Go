import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceLiveCursor,
  liveCursorFromSnapshot,
  planLiveEnd,
  planLiveNavigation,
  normalizeLiveSlide,
  presentationSlideToLegacy,
  projectLiveSnapshot,
  shouldApplyLiveEvent,
} from "../src/live/protocol.js";
import { resolveLiveSession, streamLiveEvents } from "../src/live/liveApi.ts";

test("equal state versions are accepted when event_id advances", () => {
  const cursor = { eventId: 10, stateVersion: 4 };
  const event = { event_id: 11, state_version: 4 };
  assert.equal(shouldApplyLiveEvent(cursor, event), true);
  assert.deepEqual(advanceLiveCursor(cursor, event), {
    eventId: 11,
    stateVersion: 4,
  });
});

test("reconnect replaces a stale event cursor with the fresh snapshot cursor", () => {
  const stale = { eventId: 20, stateVersion: 3 };
  const recovered = liveCursorFromSnapshot({
    last_event_id: 57,
    session: { state_version: 8 },
  });
  assert.notDeepEqual(recovered, stale);
  assert.deepEqual(recovered, { eventId: 57, stateVersion: 8 });
});

test("participant projection ignores any supplied roster and exposes only self on leaderboard", () => {
  const projection = projectLiveSnapshot(
    {
      role: "participant",
      session: { state: "leaderboard", state_version: 9 },
      participant_count: 10_000,
      participant: { id: "self", display_name: "Me", avatar: "", score: 42 },
      active_slide: null,
    },
    [{ participant_id: "other", display_name: "Other", score: 999 }],
  );
  assert.deepEqual(projection.users, []);
  assert.deepEqual(projection.leaderboardResults.map((row) => row.user_id), ["self"]);
  assert.equal(projection.leaderboardResults[0].new_points, null);
  assert.equal(projection.participantCount, 10_000);
});

test("closed questions are not projected as a fresh participant question", () => {
  const projection = projectLiveSnapshot({
    role: "participant",
    session: { state: "question_closed", state_version: 8, active_slide_id: "q1" },
    active_slide: {
      id: "q1",
      kind: "question",
      content: { text: "سؤال", question_time: 30, options: [{ text: "گزینه" }] },
    },
    participant: { id: "p1", display_name: "بازیکن", score: 0 },
    participant_count: 1,
  });

  assert.equal(projection.currentQuestion, null);
  assert.equal(projection.leaderboardResults, null);
});

test("manager projection contains only the roster page supplied by pagination", () => {
  const projection = projectLiveSnapshot(
    {
      role: "manager",
      session: { state: "leaderboard", state_version: 9 },
      participant_count: 10_000,
      participant: null,
      active_slide: null,
    },
    [{ participant_id: "page-row", display_name: "Loaded", score: 7 }],
  );
  assert.deepEqual(projection.users.map((row) => row.user_id), ["page-row"]);
  assert.equal(projection.leaderboardResults.length, 1);
  assert.equal(projection.leaderboardResults[0].new_points, null);
});

test("manager presentation mapping retains correctness while participant active slides do not", () => {
  const managerSlide = presentationSlideToLegacy({
    id: "slide-1",
    position: 0,
    kind: "question",
    content: { options: [{ text: "A", is_correct: true }, { text: "B", is_correct: false }] },
  });
  assert.deepEqual(managerSlide.options.map((option) => option.answer), [true, false]);
});

test("ended snapshots retain a bounded final leaderboard projection", () => {
  const participant = projectLiveSnapshot({
    role: "participant",
    session: { state: "ended", state_version: 12 },
    participant_count: 50,
    participant: { id: "self", display_name: "Me", score: 88 },
  });
  assert.equal(participant.leaderboardResults.length, 1);
  assert.equal(participant.leaderboardResults[0].total_points, 88);
});

test("presenter navigation plans every quiz slide sequence without invalid transitions", () => {
  const question = { slide_type: 1, slide_id: "question" };
  const content = { slide_type: 2, slide_id: "content", content_text: "Text" };
  assert.deepEqual(planLiveNavigation("draft", "start", question), ["start", "open_question"]);
  assert.deepEqual(planLiveNavigation("lobby", "start", content), ["open_content"]);
  assert.deepEqual(planLiveNavigation("question_open", "next"), ["close_question", "show_leaderboard"]);
  assert.deepEqual(planLiveNavigation("question_closed", "next"), ["show_leaderboard"]);
  assert.deepEqual(planLiveNavigation("leaderboard", "next", question), ["open_question"]);
  assert.deepEqual(planLiveNavigation("content", "next", content), ["open_content"]);
  assert.deepEqual(planLiveNavigation("ended", "next"), []);
  assert.deepEqual(planLiveEnd("question_open"), ["close_question", "end"]);
  assert.deepEqual(planLiveEnd("content"), ["end"]);
  assert.deepEqual(planLiveEnd("ended"), []);
});

test("stale event ids and true state regressions are rejected", () => {
  const cursor = { eventId: 10, stateVersion: 4 };
  assert.equal(
    shouldApplyLiveEvent(cursor, { event_id: 10, state_version: 5 }),
    false,
  );
  assert.equal(
    shouldApplyLiveEvent(cursor, { event_id: 11, state_version: 3 }),
    false,
  );
});

test("participant question projection does not retain correctness flags", () => {
  const question = normalizeLiveSlide(
    {
      id: "slide-1",
      kind: "question",
      content: {
        text: "Choose",
        question_time: 30,
        options: [
          { text: "A", is_correct: true },
          { text: "B", is_correct: false },
        ],
      },
    },
    { state_version: 7, ends_at: new Date(Date.now() + 20_000).toISOString() },
  );
  assert.equal(question.question_id, "slide-1");
  assert.deepEqual(
    question.options.map((option) => option.option_id),
    [0, 1],
  );
  assert.equal("answer" in question.options[0], false);
  assert.equal("is_correct" in question.options[0], false);
});

test("SSE starts after the snapshot cursor and parses event envelopes", async () => {
  const originalFetch = globalThis.fetch;
  const received = [];
  let requestHeaders;
  globalThis.fetch = async (_url, init) => {
    requestHeaders = new Headers(init.headers);
    const event = {
      event_id: 43,
      schema_version: 1,
      session_id: "session",
      state_version: 8,
      name: "presence.updated",
      payload: { participant_delta: 1 },
      occurred_at: new Date().toISOString(),
    };
    return new Response(`id: 43\nevent: presence.updated\ndata: ${JSON.stringify(event)}\n\n`, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  try {
    await streamLiveEvents("session", 42, {
      signal: new AbortController().signal,
      onEvent: (event) => received.push(event),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requestHeaders.get("Last-Event-ID"), "42");
  assert.deepEqual(received.map((event) => event.event_id), [43]);
});

test("access codes resolve through the Go live API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedURL = "";
  globalThis.fetch = async (url) => {
    requestedURL = String(url);
    return new Response(JSON.stringify({
      session_id: "session",
      presentation_id: "presentation",
      presentation: { title: "آزمون", background_color: "#123456", background_image_url: "", text_color: "#ffffff" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await resolveLiveSession("JOIN CODE");
    assert.equal(result.session_id, "session");
    assert.equal(result.presentation.background_color, "#123456");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestedURL, /live\/sessions\/resolve\?join_code=JOIN%20CODE$/);
});
