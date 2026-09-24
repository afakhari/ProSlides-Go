import test from "node:test";
import assert from "node:assert/strict";
import { hasLeaderboardEntries } from "../src/modules/live/model/leaderboard.ts";

test("hasLeaderboardEntries returns false for empty payloads", () => {
  assert.equal(hasLeaderboardEntries(null), false);
  assert.equal(hasLeaderboardEntries(undefined), false);
  assert.equal(hasLeaderboardEntries([]), false);
  assert.equal(hasLeaderboardEntries({ results: [] }), false);
});

test("hasLeaderboardEntries returns true for non-empty payloads", () => {
  assert.equal(hasLeaderboardEntries([{ user_id: "u1" }]), true);
  assert.equal(hasLeaderboardEntries({ results: [{ user_id: "u1" }] }), true);
});

