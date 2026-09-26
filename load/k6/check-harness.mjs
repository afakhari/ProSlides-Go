import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const smoke = readFileSync(resolve(here, "live-smoke.js"), "utf8");
const reconcile = readFileSync(resolve(here, "reconcile.sql"), "utf8");

const requiredSmoke = [
  "activityItemID",
  "activity_item_id",
  'activity_phase === "accepting"',
  'activity_phase === "closed"',
  'snapshotBody.session.activity_phase === "accepting"',
  "attemptAnswer();",
  "Math.ceil(users / joinRate) + 2",
  "PARTICIPANT_MAX_DURATION",
  'action: "present_item"',
  'action: "close_activity"',
  'action: "reveal_activity"',
  'action: "show_overall_ranking"',
];

const requiredReconcile = [
  "activity_item_id",
  "duplicate_activity_responses",
  "legacy_lifecycle_events",
  "payload->>'activity_phase' = 'closed'",
  "activity.result_updated",
  "canonical_activity_result_count",
  "ranking.updated",
  "late_answers",
];

const forbidden = [
  "questionID",
  "question_id:",
  "payload->>'state' = 'question_closed'",
  "name = 'answer.stats'",
  "name = 'leaderboard.updated'",
];

for (const token of requiredSmoke) {
  if (!smoke.includes(token)) {
    throw new Error(`live-smoke.js is missing canonical v2 marker: ${token}`);
  }
}
for (const token of requiredReconcile) {
  if (!reconcile.includes(token)) {
    throw new Error(`reconcile.sql is missing canonical v2 invariant: ${token}`);
  }
}
for (const token of forbidden) {
  if (smoke.includes(token) || reconcile.includes(token)) {
    throw new Error(`load harness retains forbidden legacy protocol marker: ${token}`);
  }
}

console.log("canonical v2 load harness guard passed");
