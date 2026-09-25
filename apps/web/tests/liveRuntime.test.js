import test from "node:test";
import assert from "node:assert/strict";

import { createLiveRuntime } from "../src/modules/live/runtime/LiveRuntime.ts";

const managerSession = (
  id,
  state = "lobby",
  stateVersion = 1,
  {
    activityPhase = null,
    stageView = "item",
    activeItemId = null,
    endsAt = null,
    remainingSeconds = null,
  } = {},
) => ({
  id,
  presentation_id: "presentation",
  host_id: "manager",
  join_code: "123456",
  state,
  state_version: stateVersion,
  active_item_id: activeItemId,
  activity_phase: activityPhase,
  stage_view: stageView,
  ends_at: endsAt,
  remaining_seconds: remainingSeconds,
});

const managerSnapshot = (
  id,
  {
    eventId = 1,
    stateVersion = 1,
    state = "lobby",
    activityPhase = null,
    stageView = "item",
    activeItemId = null,
  } = {},
) => ({
  role: "manager",
  session: managerSession(id, state, stateVersion, {
    activityPhase,
    stageView,
    activeItemId,
  }),
  participant_count: 0,
  last_event_id: eventId,
});

const emptyRoster = (order = "joined") => ({
  items: [],
  order,
  limit: 100,
  has_more: false,
  next_cursor: "",
});

const parkedStream = async (_id, _lastEventId, { signal }) =>
  new Promise((resolve) => {
    signal.addEventListener("abort", resolve, { once: true });
  });

test("disconnect resets the authoritative cursor before selecting another session", async () => {
  let requestedPresentation = "";
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000001",
      createLiveSession: async (presentationId) => {
        requestedPresentation = presentationId;
        return managerSession(`session-${presentationId}`);
      },
      getLiveSnapshot: async (id) =>
        id === "session-first"
          ? managerSnapshot(id, { eventId: 50, stateVersion: 9 })
          : managerSnapshot(id, { eventId: 1, stateVersion: 1 }),
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("first"), true);
  assert.equal(requestedPresentation, "first");
  assert.equal(runtime.getState().snapshot.last_event_id, 50);

  runtime.disconnect();
  assert.equal(runtime.getState().sessionId, null);
  assert.equal(runtime.getState().snapshot, null);

  assert.equal(await runtime.connect("second"), true);
  assert.equal(requestedPresentation, "second");
  assert.equal(runtime.getState().snapshot.session.id, "session-second");
  assert.equal(runtime.getState().snapshot.last_event_id, 1);

  runtime.destroy();
});

test("runtime accepts monotonic Activity results and ignores stale SSE events", async () => {
  let onEvent = null;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000002",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () =>
        managerSnapshot("session", { eventId: 10, stateVersion: 2 }),
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(typeof onEvent, "function");

  onEvent({
    event_id: 11,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "activity.result_updated",
    payload: {
      activity_item_id: "q1",
      response_count: 3,
      option_counts: { 0: 1, 1: 2 },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.deepEqual(runtime.getState().snapshot.activity_result.option_counts, {
    0: 1,
    1: 2,
  });

  onEvent({
    event_id: 9,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "activity.result_updated",
    payload: {
      activity_item_id: "q1",
      response_count: 99,
      option_counts: { 0: 99 },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.deepEqual(runtime.getState().snapshot.activity_result.option_counts, {
    0: 1,
    1: 2,
  });

  runtime.destroy();
});

test("failed manager actions reuse the same request id on retry", async () => {
  let sequence = 0;
  let current = managerSnapshot("session", {
    eventId: 4,
    stateVersion: 2,
    state: "lobby",
  });
  const actionRequestIds = [];
  let failFirstAction = true;

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () =>
        `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
      createLiveSession: async () => managerSession("session", "lobby", 2),
      getLiveSnapshot: async () => current,
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
      applyLiveAction: async (_id, input) => {
        actionRequestIds.push(input.request_id);
        if (failFirstAction) {
          failFirstAction = false;
          throw new Error("temporary failure");
        }
        current = managerSnapshot("session", {
          eventId: 5,
          stateVersion: 3,
          state: "presenting",
          activityPhase: "accepting",
          activeItemId: "q1",
        });
        return current.session;
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  const slide = { slide_type: 1, slide_id: "q1", question_time: 30 };

  assert.equal(await runtime.sendNavigation("start", { slide }), false);
  assert.equal(await runtime.sendNavigation("start", { slide }), true);
  assert.equal(actionRequestIds.length, 2);
  assert.equal(actionRequestIds[0], actionRequestIds[1]);
  assert.equal(runtime.getState().snapshot.session.state, "presenting");
  assert.equal(runtime.getState().snapshot.session.activity_phase, "accepting");

  runtime.destroy();
});

test("stream reconnect refreshes the snapshot before resuming from the new cursor", async () => {
  let snapshotReads = 0;
  const streamCursors = [];

  const runtime = createLiveRuntime("manager", {
    storage: null,
    sleep: async () => {},
    random: () => 0.5,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000010",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        return snapshotReads === 1
          ? managerSnapshot("session", { eventId: 5, stateVersion: 1 })
          : managerSnapshot("session", { eventId: 8, stateVersion: 2 });
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: async (_id, lastEventId, options) => {
        streamCursors.push(lastEventId);
        if (streamCursors.length === 1) {
          throw new Error("network interrupted");
        }
        return parkedStream(_id, lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);

  for (let index = 0; index < 20 && streamCursors.length < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.deepEqual(streamCursors.slice(0, 2), [5, 8]);
  assert.equal(runtime.getState().snapshot.last_event_id, 8);
  assert.equal(runtime.getState().isConnected, true);

  runtime.destroy();
});

test("presence updates preserve score ordering while the manager is on a leaderboard", async () => {
  let onEvent = null;
  const rosterOrders = [];
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000020",
      createLiveSession: async () =>
        managerSession("session", "presenting", 3, {
          activityPhase: "revealed",
          stageView: "overall_ranking",
          activeItemId: "q1",
        }),
      getLiveSnapshot: async () =>
        managerSnapshot("session", {
          eventId: 20,
          stateVersion: 3,
          state: "presenting",
          activityPhase: "revealed",
          stageView: "overall_ranking",
          activeItemId: "q1",
        }),
      getRosterPage: async (_id, order) => {
        rosterOrders.push(order);
        return emptyRoster(order);
      },
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(rosterOrders.at(-1), "score");

  onEvent({
    event_id: 21,
    schema_version: 1,
    session_id: "session",
    state_version: 3,
    name: "presence.updated",
    payload: { participant_delta: 1 },
    occurred_at: new Date().toISOString(),
  });

  for (let index = 0; index < 10 && rosterOrders.length < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(rosterOrders.at(-1), "score");
  runtime.destroy();
});

test("older roster responses cannot overwrite a newer roster request", async () => {
  let resolveJoined;
  let phase = "connect";
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000021",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => managerSnapshot("session"),
      getRosterPage: async (_id, order) => {
        if (phase === "connect") return emptyRoster(order);
        if (order === "joined") {
          return new Promise((resolve) => {
            resolveJoined = () =>
              resolve({
                ...emptyRoster("joined"),
                items: [{
                  participant_id: "stale",
                  display_name: "Stale",
                  score: 1,
                  joined_at: new Date().toISOString(),
                }],
              });
          });
        }
        return {
          ...emptyRoster("score"),
          items: [{
            participant_id: "ranked",
            display_name: "Ranked",
            score: 100,
            joined_at: new Date().toISOString(),
          }],
        };
      },
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  phase = "race";

  const staleRequest = runtime.loadRoster("joined", false);
  const currentRequest = runtime.loadRoster("score", false);
  assert.equal(await currentRequest, true);
  assert.equal(runtime.getState().rosterOrder, "score");
  assert.equal(runtime.getState().roster[0].participant_id, "ranked");

  resolveJoined();
  assert.equal(await staleRequest, false);
  assert.equal(runtime.getState().rosterOrder, "score");
  assert.equal(runtime.getState().roster[0].participant_id, "ranked");

  runtime.destroy();
});

test("a successful manager mutation stays successful when only the follow-up refresh fails", async () => {
  let snapshotReads = 0;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000022",
      createLiveSession: async () => managerSession("session", "lobby", 1),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        if (snapshotReads === 1) {
          return managerSnapshot("session", {
            eventId: 1,
            stateVersion: 1,
            state: "lobby",
          });
        }
        throw new Error("snapshot temporarily unavailable");
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
      applyLiveAction: async () =>
        managerSession("session", "presenting", 2, {
          activityPhase: "accepting",
          activeItemId: "q1",
        }),
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  const ok = await runtime.sendNavigation("start", {
    slide: { slide_type: 1, slide_id: "q1", question_time: 30 },
  });

  assert.equal(ok, true);
  assert.equal(runtime.getState().snapshot.session.state, "presenting");
  assert.equal(runtime.getState().snapshot.session.activity_phase, "accepting");
  assert.equal(runtime.getState().connectionError, "snapshot temporarily unavailable");

  runtime.destroy();
});

test("refresh requests arriving during roster loading are drained before reconnect continues", async () => {
  let onEvent = null;
  let snapshotReads = 0;
  let rosterReads = 0;
  let releaseRoster;
  const blockedRoster = new Promise((resolve) => {
    releaseRoster = resolve;
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000023",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        if (snapshotReads === 1) {
          return managerSnapshot("session", {
            eventId: 1,
            stateVersion: 1,
            state: "lobby",
          });
        }
        if (snapshotReads === 2) {
          return managerSnapshot("session", {
            eventId: 2,
            stateVersion: 2,
            state: "presenting",
          });
        }
        return managerSnapshot("session", {
          eventId: 3,
          stateVersion: 3,
          state: "presenting",
        });
      },
      getRosterPage: async (_id, order) => {
        rosterReads += 1;
        if (rosterReads === 2) await blockedRoster;
        return emptyRoster(order);
      },
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);

  onEvent({
    event_id: 2,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "session.state_changed",
    payload: {},
    occurred_at: new Date().toISOString(),
  });

  for (let index = 0; index < 20 && rosterReads < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(rosterReads, 2);

  onEvent({
    event_id: 3,
    schema_version: 1,
    session_id: "session",
    state_version: 3,
    name: "ranking.updated",
    payload: {},
    occurred_at: new Date().toISOString(),
  });

  releaseRoster();

  for (let index = 0; index < 20 && snapshotReads < 3; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(snapshotReads, 3);
  assert.equal(runtime.getState().snapshot.last_event_id, 3);
  assert.equal(runtime.getState().snapshot.session.state_version, 3);
  runtime.destroy();
});

test("disconnect during manager connect cannot resurrect stale session state", async () => {
  let releaseSnapshot;
  const snapshotReady = new Promise((resolve) => {
    releaseSnapshot = resolve;
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000024",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => {
        await snapshotReady;
        return managerSnapshot("session", {
          eventId: 9,
          stateVersion: 4,
          state: "lobby",
        });
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
    },
  });

  const connecting = runtime.connect("presentation");
  for (let index = 0; index < 10 && runtime.getState().sessionId !== "session"; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  runtime.disconnect();
  releaseSnapshot();

  assert.equal(await connecting, false);
  assert.equal(runtime.getState().sessionId, null);
  assert.equal(runtime.getState().snapshot, null);
  assert.equal(runtime.getState().isConnected, false);

  runtime.destroy();
});



test("successful participant answer retry clears the transient submission error", async () => {
  let attempts = 0;
  const requestIds = [];
  const runtime = createLiveRuntime("player", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000030",
      submitLiveAnswer: async (_id, input) => {
        attempts += 1;
        requestIds.push(input.request_id);
        if (attempts === 1) throw new Error("temporary answer failure");
        return { score_delta: 100 };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  const answer = {
    request_id: "00000000-0000-4000-8000-000000000031",
    question_id: "11111111-1111-4111-8111-111111111111",
    selected_option_indexes: [0],
  };

  assert.equal(await runtime.submitAnswer(answer), false);
  assert.equal(runtime.getState().connectionError, null);

  assert.equal(await runtime.submitAnswer(answer), true);
  assert.equal(runtime.getState().connectionError, null);
  assert.deepEqual(requestIds, [answer.request_id, answer.request_id]);

  runtime.destroy();
});


test("participant answer validation rejects malformed option indexes before transport", async () => {
  let submissions = 0;
  const runtime = createLiveRuntime("player", {
    storage: null,
    transport: {
      submitLiveAnswer: async () => {
        submissions += 1;
        return { score_delta: 0 };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  assert.equal(
    await runtime.submitAnswer({
      question_id: "q1",
      selected_option_indexes: [1, 1],
    }),
    "rejected",
  );
  assert.equal(
    await runtime.submitAnswer({
      question_id: "q1",
      selected_option_indexes: [-1],
    }),
    "rejected",
  );
  assert.equal(submissions, 0);
  runtime.destroy();
});


test("participant answer HTTP remains available while SSE is reconnecting", async () => {
  let submissions = 0;
  const participantSnapshot = {
    role: "participant",
    session: {
      id: "session",
      presentation_id: "presentation",
      state: "presenting",
      state_version: 2,
      active_item_id: "q1",
      activity_phase: "accepting",
      stage_view: "item",
      ends_at: new Date(Date.now() + 30_000).toISOString(),
      remaining_seconds: 30,
    },
    participant: {
      id: "participant",
      display_name: "Player",
      avatar: "🙂",
      score: 0,
    },
    participant_count: 1,
    last_event_id: 2,
  };

  const runtime = createLiveRuntime("player", {
    storage: null,
    sleep: async (_milliseconds, signal) =>
      new Promise((resolve) => {
        signal.addEventListener("abort", resolve, { once: true });
      }),
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000040",
      joinLiveSession: async () => ({
        id: "participant",
        display_name: "Player",
        avatar: "🙂",
      }),
      getLiveSnapshot: async () => participantSnapshot,
      streamLiveEvents: async () => {
        throw new Error("sse temporarily unavailable");
      },
      submitLiveAnswer: async (_id, input) => {
        submissions += 1;
        assert.deepEqual(input.selected_option_indexes, [0]);
        return {
          answer_id: "answer",
          score_delta: 100,
          duplicate: false,
        };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  assert.equal(
    await runtime.joinParticipant({
      name: "Player",
      avatar: "🙂",
      clientUserId: "00000000-0000-4000-8000-000000000041",
    }),
    true,
  );

  for (let index = 0; index < 20 && runtime.getState().isConnected; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(runtime.getState().isConnected, false);
  assert.equal(
    runtime.getState().connectionError,
    "sse temporarily unavailable",
  );

  assert.equal(
    await runtime.submitAnswer({
      request_id: "00000000-0000-4000-8000-000000000042",
      question_id: "q1",
      selected_option_indexes: [0],
    }),
    true,
  );
  assert.equal(submissions, 1);
  assert.equal(runtime.getState().isConnected, false);
  assert.equal(
    runtime.getState().connectionError,
    "sse temporarily unavailable",
  );

  runtime.destroy();
});
