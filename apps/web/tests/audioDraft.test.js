import assert from "node:assert/strict";
import test from "node:test";

import {
  audioDraftEquals,
  audioDraftReducer,
  audioDraftToUpdate,
  createAudioDraft,
  validateAudioDraft,
} from "../src/modules/presentations/editor/model/audioDraft.ts";

const presentation = {
  quiz_id: "presentation-1",
  revision: 11,
  access_code: "ABCDE",
  title: "ارائه صوتی",
  quiz_name: "ارائه صوتی",
  background_color: "#ffffff",
  background_image_url: "",
  text_color: "#111827",
  music_url: "  https://audio.example.test/original.mp3  ",
  background: {
    color: "#ffffff",
    image: "",
    text_color: "#111827",
  },
  slides: [],
  created_at: "2026-09-23T00:00:00Z",
  last_update: "2026-09-23T00:00:00Z",
};

test("audio draft normalizes persisted presentation audio and owns dirty comparison", () => {
  const draft = createAudioDraft(presentation);
  assert.equal(draft.musicUrl, "https://audio.example.test/original.mp3");
  assert.equal(audioDraftEquals(draft, draft), true);

  const changed = audioDraftReducer(
    { baseline: draft, draft },
    { type: "music-url", value: "https://audio.example.test/changed.mp3" },
  ).draft;

  assert.equal(audioDraftEquals(draft, changed), false);
  assert.equal(changed.revision, 11);
});

test("audio validation accepts empty or HTTP(S) URLs and rejects unsafe values", () => {
  const draft = createAudioDraft(presentation);

  assert.equal(validateAudioDraft({ ...draft, musicUrl: "" }).length, 0);
  assert.equal(
    validateAudioDraft({
      ...draft,
      musicUrl: "https://audio.example.test/track.mp3",
    }).length,
    0,
  );
  assert.equal(
    validateAudioDraft({
      ...draft,
      musicUrl: "http://audio.example.test/track.mp3",
    }).length,
    0,
  );

  assert.ok(
    validateAudioDraft({
      ...draft,
      musicUrl: "javascript:alert(1)",
    }).some((issue) => issue.code === "music_url_invalid"),
  );
  assert.ok(
    validateAudioDraft({
      ...draft,
      musicUrl: "/relative/audio.mp3",
    }).some((issue) => issue.code === "music_url_invalid"),
  );
  assert.ok(
    validateAudioDraft({
      ...draft,
      musicUrl: "https://",
    }).some((issue) => issue.code === "music_url_invalid"),
  );
});

test("audio validation counts Unicode characters and serialization preserves revision", () => {
  const draft = createAudioDraft(presentation);
  const oversized = "https://audio.example.test/" + "ع".repeat(4_100);

  assert.ok(
    validateAudioDraft({ ...draft, musicUrl: oversized })
      .some((issue) => issue.code === "music_url_too_long"),
  );

  const update = audioDraftToUpdate({
    ...draft,
    musicUrl: "  https://audio.example.test/saved.mp3  ",
  });
  assert.deepEqual(update, {
    music_url: "https://audio.example.test/saved.mp3",
    revision: 11,
  });

  assert.deepEqual(audioDraftToUpdate({ ...draft, musicUrl: "   " }), {
    music_url: "",
    revision: 11,
  });
});
