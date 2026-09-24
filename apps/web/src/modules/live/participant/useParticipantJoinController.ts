import { useEffect, useRef, useState } from "react";

import {
  createClientUserId,
  DEFAULT_AVATAR,
  getPersistedUserIdForRoom,
  readStoredProfile,
  saveStoredProfile,
} from "../model/playerProfileStorage.ts";
import { useLiveSession } from "../react/useLiveSession.ts";

export type ParticipantJoinController = {
  name: string;
  avatar: string;
  isEditing: boolean;
  isConnected: boolean;
  isJoining: boolean;
  validation: string;
  joinError: string;
  connectionError: string | null;
  setName: (value: string) => void;
  setAvatar: (value: string) => void;
  submitProfile: () => void;
  editProfile: () => void;
};

export function useParticipantJoinController(
  roomId?: string,
): ParticipantJoinController {
  const restored = readStoredProfile(roomId);
  const [name, setNameState] = useState(restored?.name ?? "");
  const [avatar, setAvatarState] = useState(
    restored?.avatar ?? DEFAULT_AVATAR,
  );
  const [isEditing, setIsEditing] = useState(!restored);
  const [isJoining, setIsJoining] = useState(Boolean(restored));
  const [validation, setValidation] = useState("");
  const [joinError, setJoinError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const joinSentRef = useRef(false);

  const {
    connect,
    joinParticipant,
    isConnected,
    lastJoinResult,
    connectionError,
  } = useLiveSession();

  useEffect(() => {
    const next = readStoredProfile(roomId);
    setNameState(next?.name ?? "");
    setAvatarState(next?.avatar ?? DEFAULT_AVATAR);
    setIsEditing(!next);
    setIsJoining(Boolean(next));
    setValidation("");
    setJoinError("");
    setAttempt(0);
    joinSentRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (isEditing || !isJoining || !roomId || isConnected) return;

    let cancelled = false;
    let retryTimer = 0;
    void connect(roomId).then((ok) => {
      if (cancelled || ok) return;
      retryTimer = window.setTimeout(
        () => setAttempt((value) => value + 1),
        Math.min(1000 * 2 ** attempt, 10_000),
      );
    });

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [attempt, connect, isConnected, isEditing, isJoining, roomId]);

  useEffect(() => {
    if (
      isEditing ||
      !isJoining ||
      !isConnected ||
      joinSentRef.current
    ) {
      return;
    }

    joinSentRef.current = true;
    let cancelled = false;
    void joinParticipant({
      name,
      avatar,
      clientUserId: getPersistedUserIdForRoom(roomId) ?? undefined,
    }).then((outcome) => {
      if (cancelled) return;
      if (outcome === true) {
        setIsJoining(false);
        setJoinError("");
        return;
      }
      joinSentRef.current = false;
      if (outcome === "rejected") {
        setJoinError(
          "ورود به این جلسه پذیرفته نشد. نام یا آواتار را بررسی کنید و دوباره تلاش کنید.",
        );
        setIsEditing(true);
        setIsJoining(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    avatar,
    isConnected,
    isEditing,
    isJoining,
    joinParticipant,
    name,
    roomId,
  ]);

  useEffect(() => {
    if (!lastJoinResult) return;
    saveStoredProfile({
      room_id: roomId,
      name: lastJoinResult.displayName || name,
      avatar: lastJoinResult.avatar || avatar,
      user_id: lastJoinResult.clientUserId,
    });
  }, [avatar, lastJoinResult, name, roomId]);

  const setName = (value: string) => {
    setNameState(value);
    setValidation("");
    setJoinError("");
  };

  const setAvatar = (value: string) => {
    setAvatarState(value);
    setJoinError("");
  };

  const submitProfile = () => {
    const cleanName = name.trim();
    if (Array.from(cleanName).length < 2) {
      setValidation("نام شما باید حداقل دو نویسه داشته باشد.");
      return;
    }
    if (Array.from(cleanName).length > 100) {
      setValidation("نام نمایشی نمی‌تواند بیش از ۱۰۰ نویسه باشد.");
      return;
    }

    const userId =
      getPersistedUserIdForRoom(roomId) ?? createClientUserId();
    saveStoredProfile({
      room_id: roomId,
      name: cleanName,
      avatar,
      user_id: userId,
    });
    setNameState(cleanName);
    setValidation("");
    setJoinError("");
    joinSentRef.current = false;
    setAttempt(0);
    setIsEditing(false);
    setIsJoining(true);
  };

  const editProfile = () => {
    joinSentRef.current = false;
    setJoinError("");
    setIsJoining(false);
    setIsEditing(true);
  };

  return {
    name,
    avatar,
    isEditing,
    isConnected,
    isJoining,
    validation,
    joinError,
    connectionError,
    setName,
    setAvatar,
    submitProfile,
    editProfile,
  };
}
