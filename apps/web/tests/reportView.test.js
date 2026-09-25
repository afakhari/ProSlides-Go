import assert from "node:assert/strict";
import test from "node:test";

import {
  choiceOptions,
  isPollActivity,
  isWordCloudActivity,
  responseLabels,
  wordCloudTerms,
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


const wordCloudActivity = {
  activity_item_id: "cloud-1",
  position: 1,
  response_count: 3,
  scored: false,
  definition: {
    schema_version: 1,
    activity_kind: "text",
    prompt: { title: "نظر جمع", text: "سه واژه بنویسید", image_url: "" },
    response: { max_length: 80, max_words: 3 },
    evaluation: { mode: "none" },
    scoring: { mode: "none" },
    timing: { duration_seconds: 30 },
    results: {
      aggregation: "word_frequency",
      show_overall_leaderboard_after: false,
    },
  },
};

test("reports derive Word Cloud from the frozen Text aggregation policy", () => {
  assert.equal(isWordCloudActivity(wordCloudActivity), true);
  assert.equal(isPollActivity(wordCloudActivity), false);
  assert.deepEqual(choiceOptions(wordCloudActivity), []);
});

test("Word Cloud responses and result terms preserve frozen text", () => {
  assert.deepEqual(
    responseLabels(wordCloudActivity, {
      response: {
        text: "داده و هوش",
        terms: ["داده", "و", "هوش"],
      },
    }),
    ["داده و هوش"],
  );

  assert.deepEqual(
    wordCloudTerms({
      activity: wordCloudActivity,
      result: {
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
      top_performers: [],
      responses: [],
      limit: 50,
      has_more: false,
    }),
    [
      { text: "داده", count: 3 },
      { text: "هوش", count: 2 },
    ],
  );
});
