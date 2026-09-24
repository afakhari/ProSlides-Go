import { createSecureUUID } from "../api/secureUuid.ts";

export const LEGACY_PLAYER_PROFILE_KEY = "presentation_player_profile_v1";
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

export const createClientUserId = (): string => createSecureUUID();

export const playerProfileKey = (roomId: RoomId): string =>
  PLAYER_PROFILE_KEY_PREFIX + String(roomId ?? "");

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

export const readStoredProfile = (roomId: RoomId): StoredPlayerProfile | null => {
  try {
    const scoped = parseProfile(
      localStorage.getItem(playerProfileKey(roomId)),
      roomId,
    );
    if (scoped) return scoped;

    // Read-only compatibility for users who joined this same room before the
    // room-scoped profile migration. New writes always use the v2 scoped key.
    return parseProfile(localStorage.getItem(LEGACY_PLAYER_PROFILE_KEY), roomId);
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
    localStorage.setItem(playerProfileKey(roomId), JSON.stringify(profile));

    const legacy = parseProfile(
      localStorage.getItem(LEGACY_PLAYER_PROFILE_KEY),
      roomId,
    );
    if (legacy) localStorage.removeItem(LEGACY_PLAYER_PROFILE_KEY);

    localStorage.removeItem("player_name");
    localStorage.removeItem("character");
    localStorage.removeItem("user_id");
  } catch {
    // Participant continuity must not depend on storage availability.
  }
};

export const getPersistedUserIdForRoom = (roomId: RoomId): string | null =>
  readStoredProfile(roomId)?.user_id ?? null;

export const clearLegacyParticipantArtifacts = (roomId: RoomId): void => {
  try {
    localStorage.removeItem("presentation_answer_queue_v1");
    localStorage.removeItem(
      "presentation_answer_queue_v2:" + String(roomId ?? "unknown"),
    );
  } catch {
    // Legacy cleanup is best-effort.
  }
};
