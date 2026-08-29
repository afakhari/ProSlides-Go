import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_PROFILE_KEY,
  DEFAULT_AVATAR,
  createClientUserId,
  readStoredProfile,
  saveStoredProfile,
  getPersistedUserIdForRoom,
} from "../src/pages/presentation/player/playerProfileStorage.js";

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

test("saveStoredProfile persists normalized room-scoped profile", () => {
  saveStoredProfile({
    room_id: 33,
    name: "  ali  ",
    avatar: "",
    user_id: 99,
  });

  const raw = globalThis.localStorage.getItem(PLAYER_PROFILE_KEY);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.room_id, "33");
  assert.equal(parsed.name, "ali");
  assert.equal(parsed.avatar, DEFAULT_AVATAR);
  assert.equal(parsed.user_id, "99");
});

test("readStoredProfile returns null for different room", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u1" });
  assert.equal(readStoredProfile(44), null);
});

test("readStoredProfile returns null for malformed payload", () => {
  globalThis.localStorage.setItem(PLAYER_PROFILE_KEY, "{not-json");
  assert.equal(readStoredProfile(33), null);
});

test("getPersistedUserIdForRoom returns id only for matching room", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
  assert.equal(getPersistedUserIdForRoom(44), null);
});

test("saveStoredProfile keeps existing user_id when update payload omits it", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  saveStoredProfile({ room_id: 33, name: "ali2", avatar: "B" });
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
});

test("getPersistedUserIdForRoom falls back to legacy storage for same room profile", () => {
  saveStoredProfile({ room_id: 33, name: "ali", avatar: "A", user_id: "u-33" });
  const raw = JSON.parse(globalThis.localStorage.getItem(PLAYER_PROFILE_KEY));
  raw.user_id = null;
  globalThis.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(raw));
  assert.equal(getPersistedUserIdForRoom(33), "u-33");
});

test("createClientUserId creates non-empty id", () => {
  const id = createClientUserId();
  assert.equal(typeof id, "string");
  assert.equal(id.length > 5, true);
});
