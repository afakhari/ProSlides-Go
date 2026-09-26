import http from "k6/http";
import { check, fail, sleep } from "k6";
import exec from "k6/execution";
import { Rate, Trend } from "k6/metrics";
import sse from "k6/x/sse";

const baseURL = (__ENV.BASE_URL || "http://api:8080").replace(/\/+$/, "");
const users = Number(__ENV.USERS || 100);
const joinRate = Number(__ENV.JOIN_RATE || 0);
const controllerDelay =
  __ENV.CONTROLLER_DELAY ||
  (joinRate > 0 ? `${Math.ceil(users / joinRate) + 2}s` : "5s");
const participantMaxDuration = __ENV.PARTICIPANT_MAX_DURATION || "3m";
const answerWindow = Number(__ENV.ANSWER_WINDOW || 10);

if (!Number.isInteger(users) || users < 1 || !Number.isFinite(joinRate) || joinRate < 0 || !Number.isFinite(answerWindow) || answerWindow <= 0) {
  throw new Error("USERS must be a positive integer; JOIN_RATE must be non-negative; ANSWER_WINDOW must be positive seconds");
}

const joinOK = new Rate("live_join_ok");
const answerOK = new Rate("live_answer_ok");
const streamOK = new Rate("live_sse_ok");
const answerDuration = new Trend("live_answer_duration", true);
const eventLag = new Trend("live_event_lag", true);

export const options = {
  scenarios: {
    participants: {
      executor: "per-vu-iterations",
      exec: "participant",
      vus: users,
      iterations: 1,
      maxDuration: participantMaxDuration,
    },
    controller: {
      executor: "shared-iterations",
      exec: "controller",
      vus: 1,
      iterations: 1,
      startTime: controllerDelay,
      maxDuration: "30s",
    },
  },
  thresholds: {
    live_join_ok: ["rate==1"],
    live_answer_ok: ["rate==1"],
    live_sse_ok: ["rate==1"],
    live_answer_duration: ["p(95)<500", "p(99)<1000"],
    live_event_lag: ["p(95)<1000", "p(99)<2000"],
    checks: ["rate>0.999"],
  },
};

const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

function requestID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function json(response, label) {
  if (!response || response.status < 200 || response.status >= 300) {
    fail(`${label} failed: status=${response && response.status} body=${response && response.body}`);
  }
  return response.json();
}

function csrf(jar) {
  const values = jar.cookiesForURL(baseURL).proslides_csrf || [];
  if (values.length === 0) fail("manager CSRF cookie missing");
  return values[0];
}

export function setup() {
  const jar = http.cookieJar();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const password = "load-smoke-password-2026";
  json(http.post(`${baseURL}/api/v1/auth/register`, JSON.stringify({
    email: `load-${suffix}@example.test`, display_name: `Load ${suffix}`, password,
  }), { headers: jsonHeaders, jar, tags: { operation: "setup_register" } }), "register");
  const csrfToken = csrf(jar);
  const managerHeaders = { ...jsonHeaders, "X-CSRF-Token": csrfToken };
  const presentation = json(http.post(`${baseURL}/api/v1/presentations`, JSON.stringify({ title: `Load smoke ${suffix}` }), {
    headers: managerHeaders, jar, tags: { operation: "setup_presentation" },
  }), "create presentation");
  const question = json(http.post(`${baseURL}/api/v1/presentations/${presentation.id}/slides`, JSON.stringify({
    position: 0,
    kind: "activity",
    content: {
      schema_version: 1,
      activity_kind: "choice",
      prompt: { title: "", text: "Load smoke question", image_url: "" },
      response: {
        selection: "single",
        options: [
          { id: "option-1", text: "Correct", image_url: "", order: 1 },
          { id: "option-2", text: "Wrong", image_url: "", order: 2 },
        ],
      },
      evaluation: { mode: "correctness", correct_option_ids: ["option-1"] },
      scoring: {
        mode: "points",
        min_points: 0,
        max_points: 100,
        speed_bonus: false,
        partial_credit: false,
      },
      timing: { duration_seconds: 120 },
      results: { show_overall_leaderboard_after: false },
    },
  }), { headers: managerHeaders, jar, tags: { operation: "setup_activity" } }), "create activity");
  const session = json(http.post(`${baseURL}/api/v1/live/sessions`, JSON.stringify({
    request_id: requestID(), presentation_id: presentation.id,
  }), { headers: managerHeaders, jar, tags: { operation: "setup_session" } }), "create session");
  const state = json(http.post(`${baseURL}/api/v1/live/sessions/${session.id}/actions`, JSON.stringify({
    request_id: requestID(), expected_state_version: session.state_version, action: "start",
  }), { headers: managerHeaders, jar, tags: { operation: "setup_start" } }), "start session");
  console.info(JSON.stringify({
    event: "live_smoke_setup",
    session_id: session.id,
    expected_participants: users,
    activity_item_id: question.id,
  }));
  const managerCookies = jar.cookiesForURL(baseURL);
  return {
    sessionID: session.id,
    activityItemID: question.id,
    stateVersion: state.state_version,
    managerSession: managerCookies.proslides_session[0],
    managerCSRF: managerCookies.proslides_csrf[0],
  };
}

export function participant(data) {
  if (joinRate > 0) sleep((exec.vu.idInTest - 1) / joinRate);
  const jar = http.cookieJar();
  const identity = requestID();
  const joined = http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/join`, JSON.stringify({
    request_id: identity,
    display_name: `Load Player ${exec.vu.idInTest}`,
    avatar: "L",
  }), { headers: jsonHeaders, jar, tags: { operation: "join" } });
  joinOK.add(joined.status === 201);
  check(joined, { "join committed": (response) => response.status === 201 });

  const snapshot = http.get(`${baseURL}/api/v1/live/sessions/${data.sessionID}/snapshot`, {
    jar, headers: { Accept: "application/json" }, tags: { operation: "snapshot" },
  });
  const snapshotBody = json(snapshot, "participant snapshot");
  let receivedClose = false;
  let answerAttempted = false;
  let answerSucceeded = false;

  const attemptAnswer = () => {
    if (answerAttempted) return;
    answerAttempted = true;
    const answered = http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/answers`, JSON.stringify({
      request_id: requestID(),
      activity_item_id: data.activityItemID,
      response: { selected_option_indexes: [0] },
    }), { headers: jsonHeaders, jar, tags: { operation: "answer" } });
    answerDuration.add(answered.timings.duration);
    answerSucceeded = answered.status === 201;
  };

  if (
    snapshotBody.session &&
    snapshotBody.session.state === "presenting" &&
    snapshotBody.session.activity_phase === "accepting" &&
    snapshotBody.session.active_item_id === data.activityItemID
  ) {
    attemptAnswer();
  }

  const response = sse.open(`${baseURL}/api/v1/live/sessions/${data.sessionID}/events`, {
    method: "GET",
    headers: { Accept: "text/event-stream", "Last-Event-ID": String(snapshotBody.last_event_id) },
    jar,
    tags: { operation: "sse" },
  }, (client) => {
    client.on("event", (event) => {
      if (event.name !== "session.state_changed") return;
      const envelope = JSON.parse(event.data);
      if (
        envelope.payload &&
        envelope.payload.state === "presenting" &&
        envelope.payload.activity_phase === "accepting" &&
        envelope.payload.active_item_id === data.activityItemID
      ) {
        attemptAnswer();
      }
      if (
        envelope.payload &&
        envelope.payload.state === "presenting" &&
        envelope.payload.activity_phase === "closed"
      ) {
        receivedClose = true;
        eventLag.add(Math.max(0, Date.now() - Date.parse(envelope.occurred_at)));
        client.close();
      }
    });
    client.on("error", () => client.close());
  });
  answerOK.add(answerSucceeded);
  streamOK.add(Boolean(response && response.status === 200 && receivedClose));
  check(response, {
    "answer committed after open event": () => answerSucceeded,
    "SSE received close event": (value) => value && value.status === 200 && receivedClose,
  });
}

export function controller(data) {
  const headers = {
    ...jsonHeaders,
    "X-CSRF-Token": data.managerCSRF,
    Cookie: `proslides_session=${data.managerSession}; proslides_csrf=${data.managerCSRF}`,
  };
  const presented = json(http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/actions`, JSON.stringify({
    request_id: requestID(),
    expected_state_version: data.stateVersion,
    action: "present_item",
    item_id: data.activityItemID,
  }), { headers, tags: { operation: "controller_present" } }), "controller present Activity");
  sleep(answerWindow);
  const closed = http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/actions`, JSON.stringify({
    request_id: requestID(),
    expected_state_version: presented.state_version,
    action: "close_activity",
  }), { headers, tags: { operation: "controller_close" } });
  check(closed, { "controller closed Activity": (value) => value.status === 201 });
}

export function teardown(data) {
  const headers = {
    ...jsonHeaders,
    "X-CSRF-Token": data.managerCSRF,
    Cookie: `proslides_session=${data.managerSession}; proslides_csrf=${data.managerCSRF}`,
  };
  const snapshot = json(http.get(`${baseURL}/api/v1/live/sessions/${data.sessionID}/snapshot`, {
    headers, tags: { operation: "teardown_snapshot" },
  }), "manager snapshot");
  let stateVersion = snapshot.session.state_version;

  if (snapshot.session.activity_phase === "closed") {
    const revealed = json(http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/actions`, JSON.stringify({
      request_id: requestID(),
      expected_state_version: stateVersion,
      action: "reveal_activity",
    }), { headers, tags: { operation: "teardown_reveal" } }), "reveal Activity");
    stateVersion = revealed.state_version;
  }

  const ranked = json(http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/actions`, JSON.stringify({
    request_id: requestID(),
    expected_state_version: stateVersion,
    action: "show_overall_ranking",
  }), { headers, tags: { operation: "teardown_ranking" } }), "show overall ranking");

  const ended = http.post(`${baseURL}/api/v1/live/sessions/${data.sessionID}/actions`, JSON.stringify({
    request_id: requestID(),
    expected_state_version: ranked.state_version,
    action: "end",
  }), { headers, tags: { operation: "teardown_end" } });
  check(ended, { "controller ended Session": (value) => value.status === 201 });
}
