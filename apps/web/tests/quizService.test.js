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
    kind: "question",
    content: {
      text: "Choose",
      question_type: "single",
      question_time: 30,
      min_point: 0,
      max_point: 100,
      faster_answers_more_points: false,
      partial_scoring: false,
      show_leaderboard_after: true,
      options: [
        { id: "a", text: "A", is_correct: true, image_url: "", order: 1 },
        { id: "b", text: "B", is_correct: false, image_url: "", order: 2 },
      ],
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
  assert.equal(definition.kind, "question");
  assert.deepEqual(definition.content.options.map((option) => option.id), ["a", "b"]);
  assert.equal(definition.content.show_leaderboard_after, true);
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
  assert.equal(JSON.parse(calls[0].init.body).content.options[0].id, "a");
});
