import assert from "node:assert/strict";
import test from "node:test";

import {
  contentDraftEquals,
  contentDraftReducer,
  contentDraftToEditorSlide,
  createContentDraft,
  validateContentDraft,
} from "../src/modules/presentations/editor/model/contentDraft.ts";
import { createContentPreviewModel } from "../src/modules/presentations/editor/model/contentPreview.ts";

const slide = {
  slide_id: "content-1",
  revision: 4,
  order: 2,
  slide_type: 2,
  show_leaderboard_after: false,
  question: null,
  title: "عنوان",
  content_text: "متن توضیحی",
  content_image_url: "",
};

test("content draft owns title text and image without JSON string dirty checks", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);
  assert.equal(contentDraftEquals(draft, draft), true);

  const changed = contentDraftReducer(
    { baseline: draft, draft },
    { type: "text", value: "متن تازه" },
  ).draft;

  assert.equal(contentDraftEquals(draft, changed), false);
  assert.equal(createContentPreviewModel(changed).text, "متن تازه");
});

test("content draft accepts title-only text-only or image-only slides", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);

  assert.equal(
    validateContentDraft({ ...draft, title: "فقط عنوان", text: "", imageUrl: "" }).length,
    0,
  );
  assert.equal(
    validateContentDraft({ ...draft, title: "", text: "فقط متن", imageUrl: "" }).length,
    0,
  );
  assert.equal(
    validateContentDraft({
      ...draft,
      title: "",
      text: "",
      imageUrl: "https://example.com/image.jpg",
    }).length,
    0,
  );
  assert.ok(
    validateContentDraft({ ...draft, title: "", text: "", imageUrl: "" })
      .some((issue) => issue.code === "content_required"),
  );
});

test("content draft validates unicode character limits used by the backend", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);

  assert.equal(
    validateContentDraft({
      ...draft,
      title: "ع".repeat(500),
      text: "م".repeat(20_000),
    }).length,
    0,
  );

  assert.ok(
    validateContentDraft({ ...draft, title: "ع".repeat(501) })
      .some((issue) => issue.code === "content_title_too_long"),
  );
  assert.ok(
    validateContentDraft({ ...draft, text: "م".repeat(20_001) })
      .some((issue) => issue.code === "content_text_too_long"),
  );
});

test("content serialization preserves authored whitespace and slide revision", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);

  const changed = {
    ...draft,
    title: "  عنوان با فاصله  ",
    text: "  خط اول\nخط دوم  ",
  };
  const serialized = contentDraftToEditorSlide(changed);

  assert.equal(serialized.revision, 4);
  assert.equal(serialized.title, "  عنوان با فاصله  ");
  assert.equal(serialized.content_text, "  خط اول\nخط دوم  ");
  assert.equal(serialized.slide_type, 2);
  assert.equal(serialized.question, null);
});
