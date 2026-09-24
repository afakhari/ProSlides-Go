import { createSecureUUID } from "../api/secureUuid.ts";

export const PLAYER_PROFILE_KEY = "presentation_player_profile_v1";
export const PLAYER_PROFILE_KEY_PREFIX = "presentation_player_profile_v2:";
export const DEFAULT_AVATAR = "🧙";

type RoomId = string | number | null | undefined;

export interface StoredPlayerProfile {
  room_id: string;
  name: string;
  avatar: string;
  user_id: string | null;
}

export interface SavePlayerProfileInput {
  room_id: RoomId;
  name?: string | null;
  avatar?: string | null;
  user_id?: string | number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const roomKey = (roomId: RoomId) =>
  `${PLAYER_PROFILE_KEY_PREFIX}${String(roomId ?? "")}`;

const parseProfile = (
  raw: string | null,
  roomId: RoomId,
): StoredPlayerProfile | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (String(parsed.room_id ?? "") !== String(roomId ?? "")) return null;
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    if (typeof parsed.avatar !== "string" || !parsed.avatar) return null;
    return {
      room_id: String(parsed.room_id),
      name: parsed.name.trim(),
      avatar: parsed.avatar,
      user_id:
        parsed.user_id != null && String(parsed.user_id).trim() !== ""
          ? String(parsed.user_id)
          : null,
    };
  } catch {
    return null;
  }
};

export const createClientUserId = (): string => createSecureUUID();

export const readStoredProfile = (roomId: RoomId): StoredPlayerProfile | null => {
  try {
    const scoped = parseProfile(localStorage.getItem(roomKey(roomId)), roomId);
    if (scoped) return scoped;

    // One-time compatibility read for profiles created before room-scoped keys.
    return parseProfile(localStorage.getItem(PLAYER_PROFILE_KEY), roomId);
  } catch {
    return null;
  }
};

export const saveStoredProfile = ({
  room_id,
  name,
  avatar,
  user_id,
}: SavePlayerProfileInput): void => {
  const roomId = String(room_id ?? "");
  const existing = readStoredProfile(roomId);
  const normalizedUserId =
    user_id != null && String(user_id).trim() !== ""
      ? String(user_id)
      : existing?.user_id ?? null;

  const profile: StoredPlayerProfile = {
    room_id: roomId,
    name: String(name ?? "").trim(),
    avatar: avatar || DEFAULT_AVATAR,
    user_id: normalizedUserId,
  };

  try {
    localStorage.setItem(roomKey(roomId), JSON.stringify(profile));
    // Keep the legacy key only as a migration breadcrumb for older clients.
    localStorage.removeItem(PLAYER_PROFILE_KEY);
    localStorage.removeItem("player_name");
    localStorage.removeItem("character");
    localStorage.removeItem("user_id");
  } catch {
    // Profile persistence improves resume behavior but must not crash live UI.
  }
};

export const getPersistedUserIdForRoom = (roomId: RoomId): string | null =>
  readStoredProfile(roomId)?.user_id ?? null;
