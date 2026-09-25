import assert from "node:assert/strict";
import test from "node:test";

import {
  choiceOptions,
  isPollActivity,
  responseLabels,
} from "../src/modules/reports/model/reportView.ts";

const pollActivity = {
  activity_item_id: "poll-1",
  position: 0,
  response_count: 2,
  scored: false,
  definition: {
    schema_version: 1,
    activity_kind: "choice",
    prompt: { title: "اولویت بعدی", text: "کدام موضوع مهم‌تر است؟" },
    response: {
      selection: "single",
      options: [
        { id: "b", text: "تست", order: 2 },
        { id: "a", text: "معماری", order: 1 },
      ],
    },
    evaluation: { mode: "none", correct_option_ids: [] },
    scoring: {
      mode: "none",
      min_points: 0,
      max_points: 0,
      speed_bonus: false,
      partial_credit: false,
    },
    timing: { duration_seconds: 30 },
    results: { show_overall_leaderboard_after: false },
  },
};

test("reports derive Poll from frozen Choice policies instead of a new Activity kind", () => {
  assert.equal(isPollActivity(pollActivity), true);
  assert.deepEqual(
    choiceOptions(pollActivity).map((option) => option.id),
    ["a", "b"],
  );
});

test("Poll response labels use frozen response positions before display ordering", () => {
  const response = {
    response: { selected_option_indexes: [0] },
  };

  assert.deepEqual(responseLabels(pollActivity, response), ["تست"]);
});
