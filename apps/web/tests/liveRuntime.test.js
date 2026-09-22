import test from "node:test";
import assert from "node:assert/strict";

import { createLiveRuntime } from "../src/modules/live/runtime/LiveRuntime.ts";

const managerSession = (id, state = "lobby", stateVersion = 1) => ({
  id,
  presentation_id: "presentation",
  host_id: "manager",
  join_code: "123456",
  state,
  state_version: stateVersion,
  active_slide_id: null,
  ends_at: null,
});

const managerSnapshot = (
  id,
  { eventId = 1, stateVersion = 1, state = "lobby" } = {},
) => ({
  role: "manager",
  session: managerSession(id, state, stateVersion),
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

test("runtime accepts monotonic answer stats and ignores stale SSE events", async () => {
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
    name: "answer.stats",
    payload: {
      question_slide_id: "q1",
      response_count: 3,
      option_counts: { 0: 1, 1: 2 },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.deepEqual(runtime.getState().snapshot.question_stats.option_counts, {
    0: 1,
    1: 2,
  });

  onEvent({
    event_id: 9,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "answer.stats",
    payload: {
      question_slide_id: "q1",
      response_count: 99,
      option_counts: { 0: 99 },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.deepEqual(runtime.getState().snapshot.question_stats.option_counts, {
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
          state: "question_open",
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
  assert.equal(runtime.getState().snapshot.session.state, "question_open");

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
      createLiveSession: async () => managerSession("session", "leaderboard", 3),
      getLiveSnapshot: async () =>
        managerSnapshot("session", {
          eventId: 20,
          stateVersion: 3,
          state: "leaderboard",
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
      applyLiveAction: async () => managerSession("session", "question_open", 2),
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  const ok = await runtime.sendNavigation("start", {
    slide: { slide_type: 1, slide_id: "q1", question_time: 30 },
  });

  assert.equal(ok, true);
  assert.equal(runtime.getState().snapshot.session.state, "question_open");
  assert.equal(runtime.getState().connectionError, "snapshot temporarily unavailable");

  runtime.destroy();
});

