import { createSecureUUID } from "../../../live/secureUuid.js";
export const PLAYER_PROFILE_KEY = "presentation_player_profile_v1";
export const DEFAULT_AVATAR = "🧙";

export const createClientUserId = () => createSecureUUID();

export const readStoredProfile = (roomId) => {
  try {
    const raw = localStorage.getItem(PLAYER_PROFILE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (String(parsed.room_id || "") !== String(roomId || "")) return null;
    if (!parsed.name || typeof parsed.name !== "string") return null;
    if (!parsed.avatar || typeof parsed.avatar !== "string") return null;

    return {
      room_id: String(parsed.room_id),
      name: parsed.name,
      avatar: parsed.avatar,
      user_id: parsed.user_id ? String(parsed.user_id) : null,
    };
  } catch {
    return null;
  }
};
export const saveStoredProfile = ({ room_id, name, avatar, user_id }) => {
  const roomIdStr = String(room_id || "");
  const existing = readStoredProfile(roomIdStr);
  const normalizedUserId =
    user_id != null && String(user_id).trim() !== ""
      ? String(user_id)
      : existing?.user_id || null;

  const profile = {
    room_id: roomIdStr,
    name: String(name || "").trim(),
    avatar: avatar || DEFAULT_AVATAR,
    user_id: normalizedUserId,
  };

  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem("player_name", profile.name);
  localStorage.setItem("character", profile.avatar);
  if (profile.user_id) {
    localStorage.setItem("user_id", profile.user_id);
  }
};

export const getPersistedUserIdForRoom = (roomId) => {
  const profile = readStoredProfile(roomId);
  if (!profile) return null;
  if (profile.user_id) return profile.user_id;

  const legacyUserId = localStorage.getItem("user_id");
  return legacyUserId ? String(legacyUserId) : null;
};
