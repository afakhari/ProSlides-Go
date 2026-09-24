import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_PLAYER_PROFILE_KEY,
  PLAYER_PROFILE_KEY_PREFIX,
  DEFAULT_AVATAR,
  clearLegacyParticipantArtifacts,
  createClientUserId,
  getPersistedUserIdForRoom,
  playerProfileKey,
  readStoredProfile,
  saveStoredProfile,
} from "../src/modules/live/model/playerProfileStorage.ts";

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

test.beforeEach(() => {
  globalThis.localStorage = createMemoryStorage();
});

test("saveStoredProfile persists a normalized room-scoped profile", () => {
  saveStoredProfile({
    room_id: 33,
    name: "  ali  ",
    avatar: "",
    user_id: 99,
  });

  const raw = globalThis.localStorage.getItem(playerProfileKey(33));
  const parsed = JSON.parse(raw);
  assert.equal(parsed.room_id, "33");
  assert.equal(parsed.name, "ali");
  assert.equal(parsed.avatar, DEFAULT_AVATAR);
  assert.equal(parsed.user_id, "99");
  assert.match(playerProfileKey(33), new RegExp("^" + PLAYER_PROFILE_KEY_PREFIX));
});

test("profiles for different rooms coexist without identity leakage", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  saveStoredProfile({ room_id: 44, name: "sara", avatar: "B", user_id: "u-44" });

  assert.equal(readStoredProfile(33)?.user_id, "u-33");
  assert.equal(readStoredProfile(44)?.user_id, "u-44");
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
  assert.equal(getPersistedUserIdForRoom(44), "u-44");
});

test("readStoredProfile accepts matching v1 profile only as read compatibility", () => {
  globalThis.localStorage.setItem(
    LEGACY_PLAYER_PROFILE_KEY,
    JSON.stringify({
      room_id: "33",
      name: "ali",
      avatar: "A",
      user_id: "legacy-33",
    }),
  );

  assert.equal(readStoredProfile(33)?.user_id, "legacy-33");
  assert.equal(readStoredProfile(44), null);

  saveStoredProfile({
    room_id: 33,
    name: "ali",
    avatar: "A",
    user_id: "legacy-33",
  });
  assert.equal(globalThis.localStorage.getItem(LEGACY_PLAYER_PROFILE_KEY), null);
  assert.equal(getPersistedUserIdForRoom(33), "legacy-33");
});

test("readStoredProfile returns null for malformed payload", () => {
  globalThis.localStorage.setItem(playerProfileKey(33), "{not-json");
  assert.equal(readStoredProfile(33), null);
});

test("saveStoredProfile keeps existing room-scoped user id when omitted", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  saveStoredProfile({ room_id: 33, name: "ali2", avatar: "B" });
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
});

test("legacy global user id is never reused for another room", () => {
  globalThis.localStorage.setItem("user_id", "legacy-global");
  assert.equal(getPersistedUserIdForRoom(77), null);
});

test("legacy participant answer queues are removed without creating replacements", () => {
  globalThis.localStorage.setItem("presentation_answer_queue_v1", "[]");
  globalThis.localStorage.setItem("presentation_answer_queue_v2:33", "[]");
  clearLegacyParticipantArtifacts(33);

  assert.equal(globalThis.localStorage.getItem("presentation_answer_queue_v1"), null);
  assert.equal(
    globalThis.localStorage.getItem("presentation_answer_queue_v2:33"),
    null,
  );
});

test("createClientUserId creates non-empty id", () => {
  const id = createClientUserId();
  assert.equal(typeof id, "string");
  assert.equal(id.length > 5, true);
});
