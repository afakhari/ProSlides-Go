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
} from "../src/modules/live/runtime/protocol.ts";
import { resolveLiveSession, streamLiveEvents } from "../src/modules/live/api/liveApi.ts";

const choiceItem = ({
  id = "activity-1",
  duration = 30,
  correct = ["a"],
  showRanking = false,
} = {}) => ({
  id,
  kind: "activity",
  position: 0,
  content: {
    schema_version: 1,
    activity_kind: "choice",
    prompt: { title: "Quiz", text: "Choose", image_url: "" },
    response: {
      selection: "single",
      options: [
        { id: "a", text: "A", image_url: "", order: 1 },
        { id: "b", text: "B", image_url: "", order: 2 },
      ],
    },
    evaluation: { mode: "correctness", correct_option_ids: correct },
    scoring: {
      mode: "points",
      min_points: 0,
      max_points: 100,
      speed_bonus: false,
      partial_credit: false,
    },
    timing: { duration_seconds: duration },
    results: { show_overall_leaderboard_after: showRanking },
  },
});

const pollItem = () => {
  const item = choiceItem();
  item.content.prompt = { title: "Poll", text: "Pick one", image_url: "" };
  item.content.evaluation = { mode: "none", correct_option_ids: [] };
  item.content.scoring = {
    mode: "none",
    min_points: 0,
    max_points: 0,
    speed_bonus: false,
    partial_credit: false,
  };
  item.content.results = { show_overall_leaderboard_after: false };
  return item;
};

const wordCloudItem = () => ({
  id: "cloud-1",
  kind: "activity",
  position: 1,
  content: {
    schema_version: 1,
    activity_kind: "text",
    prompt: {
      title: "Cloud",
      text: "Describe the session",
      image_url: "",
    },
    response: {
      max_length: 80,
      max_words: 3,
    },
    evaluation: { mode: "none" },
    scoring: { mode: "none" },
    timing: { duration_seconds: 30 },
    results: {
      aggregation: "word_frequency",
      show_overall_leaderboard_after: false,
    },
  },
});

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

test("participant projection ignores supplied roster and exposes only self on overall ranking", () => {
  const projection = projectLiveSnapshot(
    {
      role: "participant",
      session: {
        state: "presenting",
        state_version: 9,
        activity_phase: "revealed",
        stage_view: "overall_ranking",
      },
      participant_count: 10_000,
      participant: { id: "self", display_name: "Me", avatar: "", score: 42, rank: 3 },
      active_item: choiceItem(),
    },
    [{ participant_id: "other", display_name: "Other", score: 999, rank: 1 }],
  );
  assert.deepEqual(projection.users, []);
  assert.deepEqual(projection.leaderboardResults.map((row) => row.user_id), ["self"]);
  assert.equal(projection.leaderboardResults[0].rank, 3);
  assert.equal(projection.participantCount, 10_000);
});

test("closed Activities are not projected as a fresh participant question", () => {
  const projection = projectLiveSnapshot({
    role: "participant",
    session: {
      state: "presenting",
      state_version: 8,
      active_item_id: "activity-1",
      activity_phase: "closed",
      stage_view: "item",
    },
    active_item: choiceItem(),
    participant: { id: "p1", display_name: "بازیکن", score: 0 },
    participant_count: 1,
  });

  assert.equal(projection.currentQuestion, null);
  assert.equal(projection.leaderboardResults, null);
});

test("revealed Activity projects a read-only participant result before overall ranking", () => {
  const projection = projectLiveSnapshot({
    role: "participant",
    session: {
      state: "presenting",
      state_version: 9,
      active_item_id: "activity-1",
      activity_phase: "revealed",
      stage_view: "item",
    },
    active_item: choiceItem(),
    participant: { id: "p1", display_name: "Player", score: 100 },
    participant_count: 3,
    activity_result: {
      activity_item_id: "activity-1",
      activity_kind: "choice",
      schema_version: 1,
      response_count: 3,
      payload: { option_counts: { 0: 2, 1: 1 } },
    },
  });

  assert.equal(projection.currentQuestion.question_id, "activity-1");
  assert.equal(projection.questionResults.question_id, "activity-1");
  assert.equal(projection.questionResults.response_count, 3);
  assert.deepEqual(
    projection.questionResults.optionsResult.map((row) => row.number_of_submits),
    [2, 1],
  );
  assert.equal(projection.leaderboardResults, null);
});

test("manager retains the closed Activity so results can render before ranking", () => {
  const projection = projectLiveSnapshot({
    role: "manager",
    session: {
      state: "presenting",
      state_version: 8,
      active_item_id: "activity-1",
      activity_phase: "closed",
      stage_view: "item",
    },
    active_item: choiceItem(),
    participant_count: 2,
    activity_result: {
      activity_item_id: "activity-1",
      activity_kind: "choice",
      schema_version: 1,
      response_count: 2,
      payload: { option_counts: { 0: 1, 1: 1 } },
    },
  });

  assert.equal(projection.currentQuestion.question_id, "activity-1");
  assert.equal(projection.questionResults.question_id, "activity-1");
  assert.equal(projection.leaderboardResults, null);
});

test("manager projection contains only the bounded roster page supplied by pagination", () => {
  const projection = projectLiveSnapshot(
    {
      role: "manager",
      session: {
        state: "presenting",
        state_version: 9,
        activity_phase: "revealed",
        stage_view: "overall_ranking",
      },
      participant_count: 10_000,
    },
    [{ participant_id: "page-row", display_name: "Loaded", score: 7, rank: 4 }],
  );
  assert.deepEqual(projection.users.map((row) => row.user_id), ["page-row"]);
  assert.equal(projection.leaderboardResults.length, 1);
  assert.equal(projection.leaderboardResults[0].rank, 4);
});

test("canonical Choice Activities preserve manager correctness in the authored adapter", () => {
  const managerSlide = presentationSlideToLegacy({
    ...choiceItem({ id: "slide-activity", duration: 45, showRanking: true }),
    revision: 1,
  });

  assert.equal(managerSlide.item_kind, "activity");
  assert.equal(managerSlide.question_text, "Choose");
  assert.equal(managerSlide.question_time, 45);
  assert.equal(managerSlide.show_leaderboard_after, true);
  assert.deepEqual(managerSlide.options.map((option) => option.answer), [true, false]);
});

test("Poll projects through the existing Choice live protocol without correctness or scoring", () => {
  const question = normalizeLiveSlide(pollItem(), {
    state_version: 4,
    activity_phase: "revealed",
    stage_view: "item",
  });

  assert.equal(question.question_id, "activity-1");
  assert.equal(question.question_type, "single");
  assert.equal(question.is_scored, false);
  assert.equal(question.has_correct_answer, false);
  assert.equal(question.show_leaderboard_after, false);
  assert.deepEqual(
    question.options.map((option) => "answer" in option),
    [false, false],
  );

  const projection = projectLiveSnapshot({
    role: "participant",
    session: {
      state: "presenting",
      state_version: 4,
      active_item_id: "activity-1",
      activity_phase: "revealed",
      stage_view: "item",
    },
    active_item: pollItem(),
    participant: { id: "p1", display_name: "Player", score: 0 },
    participant_count: 2,
    activity_result: {
      activity_item_id: "activity-1",
      activity_kind: "choice",
      schema_version: 1,
      response_count: 2,
      payload: { option_counts: { 0: 1, 1: 1 } },
    },
    has_scoring: false,
  });

  assert.equal(projection.currentQuestion.is_scored, false);
  assert.equal(projection.currentQuestion.has_correct_answer, false);
  assert.equal(projection.questionResults.response_count, 2);
  assert.deepEqual(
    projection.questionResults.optionsResult.map((row) => row.number_of_submits),
    [1, 1],
  );
  assert.equal(projection.leaderboardResults, null);
});

test("Word Cloud projects through the generic Activity lifecycle and result envelope", () => {
  const question = normalizeLiveSlide(wordCloudItem(), {
    state_version: 6,
    activity_phase: "accepting",
    stage_view: "item",
    remaining_seconds: 17,
  });

  assert.equal(question.activity_kind, "text");
  assert.equal(question.question_id, "cloud-1");
  assert.equal(question.question_type, "text");
  assert.equal(question.is_scored, false);
  assert.equal(question.has_correct_answer, false);
  assert.equal(question.response_max_words, 3);
  assert.equal(question.response_max_length, 80);
  assert.equal(question.remaining_seconds, 17);
  assert.deepEqual(question.options, []);

  const projection = projectLiveSnapshot({
    role: "participant",
    session: {
      state: "presenting",
      state_version: 7,
      active_item_id: "cloud-1",
      activity_phase: "revealed",
      stage_view: "item",
    },
    active_item: wordCloudItem(),
    participant: { id: "p1", display_name: "Player", score: 0 },
    participant_count: 3,
    activity_result: {
      activity_item_id: "cloud-1",
      activity_kind: "text",
      schema_version: 1,
      response_count: 3,
      payload: {
        terms: [
          { text: "داده", count: 3 },
          { text: "هوش", count: 2 },
        ],
      },
    },
    has_scoring: false,
  });

  assert.equal(projection.currentQuestion.activity_kind, "text");
  assert.equal(projection.questionResults.response_count, 3);
  assert.deepEqual(projection.questionResults.wordTerms, [
    { text: "داده", count: 3 },
    { text: "هوش", count: 2 },
  ]);
  assert.equal(projection.leaderboardResults, null);
});

test("ended snapshots retain a bounded final ranking projection", () => {
  const participant = projectLiveSnapshot({
    role: "participant",
    session: {
      state: "ended",
      state_version: 12,
      activity_phase: null,
      stage_view: "item",
    },
    participant_count: 50,
    participant: { id: "self", display_name: "Me", score: 88, rank: 2 },
  });
  assert.equal(participant.leaderboardResults.length, 1);
  assert.equal(participant.leaderboardResults[0].total_points, 88);
  assert.equal(participant.leaderboardResults[0].rank, 2);
});

test("presenter navigation preserves the result boundary before optional overall ranking", () => {
  const activity = { item_kind: "activity", slide_id: "activity" };
  const content = { item_kind: "content", slide_id: "content", content_text: "Text" };
  const ranking = { item_kind: "legacy-leaderboard" };

  assert.deepEqual(planLiveNavigation("draft", "start", activity), ["start", "present_item"]);
  assert.deepEqual(planLiveNavigation("lobby", "start", content), ["present_item"]);
  assert.deepEqual(
    planLiveNavigation("presenting", "next", null, "accepting", "item"),
    ["close_activity", "reveal_activity"],
  );
  assert.deepEqual(
    planLiveNavigation("presenting", "next", null, "closed", "item"),
    ["reveal_activity"],
  );
  assert.deepEqual(
    planLiveNavigation("presenting", "next", null, "revealed", "item"),
    ["show_overall_ranking"],
  );
  assert.deepEqual(
    planLiveNavigation("presenting", "next", activity, "revealed", "overall_ranking"),
    ["present_item"],
  );
  assert.deepEqual(
    planLiveNavigation("presenting", "next", content, null, "item"),
    ["present_item"],
  );
  assert.deepEqual(
    planLiveNavigation("presenting", "next", ranking, "revealed", "item"),
    ["show_overall_ranking"],
  );
  assert.deepEqual(planLiveNavigation("ended", "next"), []);
  assert.deepEqual(planLiveEnd("presenting", "accepting"), ["close_activity", "end"]);
  assert.deepEqual(planLiveEnd("presenting", "revealed"), ["end"]);
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

test("protocol rejects non-finite event identifiers without advancing the cursor", () => {
  const cursor = { eventId: 10, stateVersion: 4 };
  const malformed = { event_id: Number.NaN, state_version: 5 };
  assert.equal(shouldApplyLiveEvent(cursor, malformed), false);
  assert.deepEqual(advanceLiveCursor(cursor, malformed), cursor);
});

test("malformed content item is normalized without leaking unknown fields", () => {
  const content = normalizeLiveSlide(
    {
      id: "content-1",
      kind: "content",
      position: 3,
      content: "not-an-object",
      unexpected: "private",
    },
    { state_version: 2 },
  );

  assert.deepEqual(content, {
    item_kind: "content",
    slide_id: "content-1",
    order: 3,
    title: "",
    content_text: "",
    content_image_url: "",
  });
  assert.equal("unexpected" in content, false);
});

test("participant canonical Activity projection does not invent correctness when metadata is absent", () => {
  const raw = choiceItem();
  delete raw.content.evaluation.correct_option_ids;
  const question = normalizeLiveSlide(raw, {
    state_version: 7,
    activity_phase: "accepting",
    stage_view: "item",
    ends_at: new Date(Date.now() + 20_000).toISOString(),
  });
  assert.equal(question.question_id, "activity-1");
  assert.deepEqual(question.options.map((option) => option.option_id), [0, 1]);
  assert.equal("answer" in question.options[0], false);
});

test("server-computed remaining_seconds wins over a skewed deadline and is clamped", () => {
  const question = normalizeLiveSlide(choiceItem({ duration: 30 }), {
    state_version: 12,
    activity_phase: "accepting",
    stage_view: "item",
    ends_at: new Date(Date.now() + 30_000).toISOString(),
    remaining_seconds: 8,
  });
  assert.equal(question.remaining_seconds, 8);
  assert.equal(question.question_time, 30);

  const over = normalizeLiveSlide(choiceItem({ duration: 10 }), {
    state_version: 1,
    activity_phase: "accepting",
    stage_view: "item",
    ends_at: null,
    remaining_seconds: 999,
  });
  assert.equal(over.remaining_seconds, 10);

  const under = normalizeLiveSlide(choiceItem({ duration: 10 }), {
    state_version: 1,
    activity_phase: "accepting",
    stage_view: "item",
    ends_at: null,
    remaining_seconds: -4,
  });
  assert.equal(under.remaining_seconds, 0);
});

test("missing server remaining_seconds falls back to ends_at", () => {
  const question = normalizeLiveSlide(choiceItem({ duration: 20 }), {
    state_version: 1,
    activity_phase: "accepting",
    stage_view: "item",
    ends_at: new Date(Date.now() + 5_000).toISOString(),
  });
  assert.ok(question.remaining_seconds > 0);
  assert.ok(question.remaining_seconds <= 7);
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
      presentation: {
        title: "آزمون",
        background_color: "#123456",
        background_image_url: "",
        music_url: "https://example.test/theme.mp3",
        text_color: "#ffffff",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await resolveLiveSession("JOIN CODE");
    assert.equal(result.session_id, "session");
    assert.equal(result.presentation.background_color, "#123456");
    assert.equal(result.presentation.music_url, "https://example.test/theme.mp3");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestedURL, /live\/sessions\/resolve\?join_code=JOIN%20CODE$/);
});
