import test from "node:test";
import assert from "node:assert/strict";

import {
  editorSlideToDefinition,
  presentationToEditor,
  quizService,
} from "../src/modules/presentations/api/presentationRepository.ts";

const presentationDTO = {
  id: "presentation-1",
  revision: 7,
  title: "Demo",
  access_code: "DEMO42",
  settings: { background_color: "#fff", music_url: "old.mp3" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  slides: [{
    id: "slide-1",
    revision: 3,
    position: 0,
    kind: "activity",
    content: {
      schema_version: 1,
      activity_kind: "choice",
      prompt: { title: "", text: "Choose", image_url: "" },
      response: {
        selection: "single",
        options: [
          { id: "a", text: "A", image_url: "", order: 1 },
          { id: "b", text: "B", image_url: "", order: 2 },
        ],
      },
      evaluation: { mode: "correctness", correct_option_ids: ["a"] },
      scoring: {
        mode: "points",
        min_points: 0,
        max_points: 100,
        speed_bonus: false,
        partial_credit: false,
      },
      timing: { duration_seconds: 30 },
      results: { show_overall_leaderboard_after: true },
    },
  }],
};

test("presentation adapter keeps revisions and stable option identities", () => {
  const editor = presentationToEditor(presentationDTO);
  assert.equal(editor.revision, 7);
  assert.equal(editor.access_code, "DEMO42");
  assert.equal(editor.slides[0].revision, 3);
  assert.deepEqual(editor.slides[0].question.options.map((option) => option.option_id), ["a", "b"]);

  const definition = editorSlideToDefinition(editor.slides[0]);
  assert.equal(definition.kind, "activity");
  assert.deepEqual(
    definition.content.response.options.map((option) => option.id),
    ["a", "b"],
  );
  assert.deepEqual(definition.content.evaluation.correct_option_ids, ["a"]);
  assert.equal(
    definition.content.results.show_overall_leaderboard_after,
    true,
  );
});

test("Choice transport round-trips unevaluated unscored policy without inventing correctness or score", () => {
  const pollDTO = {
    ...presentationDTO,
    slides: [{
      ...presentationDTO.slides[0],
      id: "poll-1",
      content: {
        ...presentationDTO.slides[0].content,
        response: {
          ...presentationDTO.slides[0].content.response,
          selection: "multiple",
        },
        evaluation: {
          mode: "none",
          correct_option_ids: [],
        },
        scoring: {
          mode: "none",
          min_points: 0,
          max_points: 0,
          speed_bonus: false,
          partial_credit: false,
        },
        results: {
          show_overall_leaderboard_after: false,
        },
      },
    }],
  };

  const editor = presentationToEditor(pollDTO);
  const slide = editor.slides[0];

  assert.equal(slide.item_kind, "activity");
  assert.equal(slide.activity_kind, "choice");
  assert.equal(slide.schema_version, 1);
  assert.equal(slide.question.evaluation_mode, "none");
  assert.equal(slide.question.scoring_mode, "none");
  assert.deepEqual(
    slide.question.options.map((option) => option.is_correct),
    [false, false],
  );

  const definition = editorSlideToDefinition(slide);
  assert.equal(definition.kind, "activity");
  assert.equal(definition.content.activity_kind, "choice");
  assert.equal(definition.content.evaluation.mode, "none");
  assert.deepEqual(definition.content.evaluation.correct_option_ids, []);
  assert.equal(definition.content.scoring.mode, "none");
  assert.equal(definition.content.scoring.max_points, 0);
  assert.equal(
    definition.content.results.show_overall_leaderboard_after,
    false,
  );
});

test("Word Cloud round-trips through the canonical Text Activity transport", () => {
  const slide = {
    slide_id: "text-1",
    revision: 2,
    order: 3,
    item_kind: "activity",
    activity_kind: "text",
    schema_version: 1,
    show_leaderboard_after: false,
    question: null,
    text_activity: {
      title: "نظر جمع",
      text: "سه واژه بنویسید",
      image_url: "",
      max_length: 80,
      max_words: 3,
      time_limit: 30,
      aggregation: "word_frequency",
    },
  };

  const definition = editorSlideToDefinition(slide);
  assert.equal(definition.kind, "activity");
  assert.equal(definition.content.activity_kind, "text");
  assert.deepEqual(definition.content.response, {
    max_length: 80,
    max_words: 3,
  });
  assert.deepEqual(definition.content.evaluation, { mode: "none" });
  assert.deepEqual(definition.content.scoring, { mode: "none" });
  assert.equal(definition.content.results.aggregation, "word_frequency");
  assert.equal(
    definition.content.results.show_overall_leaderboard_after,
    false,
  );

  const restored = presentationToEditor({
    ...presentationDTO,
    slides: [{
      id: "text-1",
      revision: 2,
      position: 3,
      kind: "activity",
      content: definition.content,
    }],
  }).slides[0];

  assert.equal(restored.activity_kind, "text");
  assert.equal(restored.question, null);
  assert.equal(restored.text_activity.max_words, 3);
  assert.equal(restored.text_activity.aggregation, "word_frequency");
});

test("persisted leaderboard transport fails closed after migration", () => {
  assert.throws(
    () => presentationToEditor({
      ...presentationDTO,
      slides: [{
        id: "legacy-ranking",
        revision: 1,
        position: 1,
        kind: "leaderboard",
        content: { title: "Leaderboard" },
      }],
    }),
    /Unsupported editor item transport kind/,
  );
});

test("unknown canonical Activity kinds fail closed instead of becoming legacy question drafts", () => {
  assert.throws(
    () => editorSlideToDefinition({
      slide_id: "scale-1",
      revision: 1,
      order: 0,
      item_kind: "activity",
      activity_kind: "scale",
      schema_version: 1,
      show_leaderboard_after: false,
      question: null,
    }),
    /Unsupported editor item definition/,
  );
});

test("access code update uses its dedicated CSRF-protected endpoint", async (t) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ access_code: "QUIZ42" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await quizService.setAccessCode("presentation-1", "quiz42");
  assert.equal(result.access_code, "QUIZ42");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PUT");
  assert.match(String(calls[0].url), /presentations\/presentation-1\/access-code$/);
  assert.deepEqual(JSON.parse(calls[0].init.body), { access_code: "quiz42" });
});

test("presentation setting update is one conditional PATCH and does not resend stale fields", async (t) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      ...presentationDTO,
      revision: 8,
      settings: { ...presentationDTO.settings, music_url: "new.mp3" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const updated = await quizService.updateQuizMusic("presentation-1", "new.mp3", 7);
  assert.equal(updated.revision, 8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(new Headers(calls[0].init.headers).get("If-Match"), "7");
  assert.deepEqual(JSON.parse(calls[0].init.body), { settings: { music_url: "new.mp3" } });
});

test("slide update is one conditional PUT with the canonical definition", async (t) => {
  const editor = presentationToEditor(presentationDTO);
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ...presentationDTO.slides[0], revision: 4 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const saved = await quizService.updateSlide("presentation-1", "slide-1", editor.slides[0]);
  assert.equal(saved.revision, 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PUT");
  assert.equal(new Headers(calls[0].init.headers).get("If-Match"), "3");
  assert.equal(
    JSON.parse(calls[0].init.body).content.response.options[0].id,
    "a",
  );
});
