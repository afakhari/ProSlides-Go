import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesignDraft,
  designDraftEquals,
  designDraftReducer,
  designDraftToUpdate,
  validateDesignDraft,
} from "../src/modules/presentations/editor/model/designDraft.ts";

const presentation = {
  quiz_id: "presentation-1",
  revision: 9,
  access_code: "ABCDE",
  title: "ارائه طراحی",
  quiz_name: "ارائه طراحی",
  background_color: "#ffffff",
  background_image_url: "",
  text_color: "#ffffff",
  music_url: "",
  background: {
    color: "#ffffff",
    image: "",
    text_color: "#ffffff",
  },
  slides: [],
  created_at: "2026-09-22T00:00:00Z",
  last_update: "2026-09-22T00:00:00Z",
};

test("design draft normalizes persisted colors to the same readable theme used at runtime", () => {
  const draft = createDesignDraft(presentation);
  assert.equal(draft.backgroundColor, "#ffffff");
  assert.equal(draft.textColor, "#0f172a");
});

test("background and text changes remain contrast-safe in the design draft", () => {
  const draft = createDesignDraft(presentation);
  let state = { baseline: draft, draft };

  state = designDraftReducer(state, {
    type: "background-color",
    value: "#111111",
  });
  assert.equal(state.draft.backgroundColor, "#111111");
  assert.equal(state.draft.textColor, "#ffffff");

  state = designDraftReducer(state, {
    type: "background-color",
    value: "#ffffff",
  });
  state = designDraftReducer(state, {
    type: "text-color",
    value: "#ffffff",
  });
  assert.equal(state.draft.textColor, "#0f172a");
});

test("design image validation accepts HTTP(S) and rejects unsafe or oversized values", () => {
  const draft = createDesignDraft(presentation);

  assert.equal(
    validateDesignDraft({
      ...draft,
      backgroundImageUrl: "https://example.com/background.jpg",
    }).length,
    0,
  );

  assert.ok(
    validateDesignDraft({
      ...draft,
      backgroundImageUrl: "javascript:alert(1)",
    }).some((issue) => issue.code === "background_image_invalid"),
  );

  assert.ok(
    validateDesignDraft({
      ...draft,
      backgroundImageUrl: `https://example.com/${"a".repeat(4_100)}`,
    }).some((issue) => issue.code === "background_image_too_long"),
  );
});

test("design dirty comparison and serialization preserve presentation revision", () => {
  const draft = createDesignDraft(presentation);
  assert.equal(designDraftEquals(draft, draft), true);

  const changed = designDraftReducer(
    { baseline: draft, draft },
    { type: "background-color", value: "#312e81" },
  ).draft;

  assert.equal(designDraftEquals(draft, changed), false);

  const update = designDraftToUpdate(changed);
  assert.equal(update.revision, 9);
  assert.equal(update.background_color, "#312e81");
  assert.equal(update.text_color, "#ffffff");
});
