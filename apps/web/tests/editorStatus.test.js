import assert from "node:assert/strict";
import test from "node:test";

import { editorStatusReducer, initialEditorStatus } from "../src/modules/presentations/editor/model/useEditorStatus.ts";

test("editor status combines dirty areas without losing independent panel state", () => {
  const contentDirty = editorStatusReducer(initialEditorStatus, { type: "set-dirty", area: "content", dirty: true });
  const designDirty = editorStatusReducer(contentDirty, { type: "set-dirty", area: "design", dirty: true });
  const contentSaved = editorStatusReducer(designDirty, { type: "set-dirty", area: "content", dirty: false });

  assert.equal(contentSaved.dirty.content, false);
  assert.equal(contentSaved.dirty.design, true);
});

test("editor conflict state remains explicit until recovery clears it", () => {
  const conflicted = editorStatusReducer(initialEditorStatus, { type: "conflict", message: "نسخه جدید بارگذاری شد." });
  assert.equal(conflicted.conflictMessage, "نسخه جدید بارگذاری شد.");
  assert.equal(editorStatusReducer(conflicted, { type: "clear-conflict" }).conflictMessage, null);
});
