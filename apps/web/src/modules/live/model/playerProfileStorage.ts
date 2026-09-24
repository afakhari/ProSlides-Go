import { createSecureUUID } from "../api/secureUuid";

export const PLAYER_PROFILE_KEY = "presentation_player_profile_v1";
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

export const readStoredProfile = (roomId: RoomId): StoredPlayerProfile | null => {
  try {
    const raw = localStorage.getItem(PLAYER_PROFILE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (String(parsed.room_id ?? "") !== String(roomId ?? "")) return null;
    if (typeof parsed.name !== "string" || !parsed.name) return null;
    if (typeof parsed.avatar !== "string" || !parsed.avatar) return null;

    return {
      room_id: String(parsed.room_id),
      name: parsed.name,
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

  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem("player_name", profile.name);
  localStorage.setItem("character", profile.avatar);
  if (profile.user_id) localStorage.setItem("user_id", profile.user_id);
};

export const getPersistedUserIdForRoom = (roomId: RoomId): string | null => {
  const profile = readStoredProfile(roomId);
  if (!profile) return null;
  if (profile.user_id) return profile.user_id;

  const legacyUserId = localStorage.getItem("user_id");
  return legacyUserId ? String(legacyUserId) : null;
};
