import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_PROFILE_KEY,
  PLAYER_PROFILE_KEY_PREFIX,
  DEFAULT_AVATAR,
  createClientUserId,
  readStoredProfile,
  saveStoredProfile,
  getPersistedUserIdForRoom,
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

const roomKey = (roomId) => `${PLAYER_PROFILE_KEY_PREFIX}${roomId}`;

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

  const raw = globalThis.localStorage.getItem(roomKey(33));
  const parsed = JSON.parse(raw);
  assert.equal(parsed.room_id, "33");
  assert.equal(parsed.name, "ali");
  assert.equal(parsed.avatar, DEFAULT_AVATAR);
  assert.equal(parsed.user_id, "99");
  assert.equal(globalThis.localStorage.getItem(PLAYER_PROFILE_KEY), null);
});

test("profiles for different rooms coexist without identity leakage", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  saveStoredProfile({ room_id: 44, name: "sara", avatar: "B", user_id: "u-44" });

  assert.equal(readStoredProfile(33)?.user_id, "u-33");
  assert.equal(readStoredProfile(44)?.user_id, "u-44");
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
  assert.equal(getPersistedUserIdForRoom(44), "u-44");
});

test("readStoredProfile accepts the matching legacy profile during migration", () => {
  globalThis.localStorage.setItem(
    PLAYER_PROFILE_KEY,
    JSON.stringify({
      room_id: "33",
      name: "ali",
      avatar: "A",
      user_id: "legacy-33",
    }),
  );

  assert.equal(readStoredProfile(33)?.user_id, "legacy-33");
  assert.equal(readStoredProfile(44), null);
});

test("readStoredProfile returns null for malformed payload", () => {
  globalThis.localStorage.setItem(roomKey(33), "{not-json");
  assert.equal(readStoredProfile(33), null);
});

test("saveStoredProfile keeps an existing room user_id when omitted", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  saveStoredProfile({ room_id: 33, name: "ali2", avatar: "B" });
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
});

test("room identity does not fall back to legacy global user_id", () => {
  globalThis.localStorage.setItem("user_id", "other-room-user");
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A" });
  assert.equal(getPersistedUserIdForRoom(33), null);
});

test("createClientUserId creates a non-empty id", () => {
  const id = createClientUserId();
  assert.equal(typeof id, "string");
  assert.equal(id.length > 5, true);
});
