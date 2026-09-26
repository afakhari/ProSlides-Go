import { useCallback, useEffect, useRef, useState } from "react";

import {
  createClientUserId,
  DEFAULT_AVATAR,
  getPersistedUserIdForRoom,
  readStoredProfile,
  saveStoredProfile,
} from "../model/playerProfileStorage.ts";
import { useLiveSession } from "../react/useLiveSession.ts";

type ParticipantJoinController = {
  name: string;
  avatar: string;
  isEditing: boolean;
  isConnected: boolean;
  isStreamConnected: boolean;
  isJoining: boolean;
  validation: string;
  joinError: string;
  connectionError: string | null;
  setName: (value: string) => void;
  setAvatar: (value: string) => void;
  submitProfile: () => void;
  retryNow: () => void;
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
  const retryBlockedRef = useRef(false);
  const retryTimerRef = useRef(0);

  const {
    connect,
    joinParticipant,
    isConnected,
    isStreamConnected,
    lastJoinResult,
    connectionError,
  } = useLiveSession();

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = 0;
    }
    retryBlockedRef.current = false;
  }, []);

  useEffect(() => () => clearRetry(), [clearRetry]);

  const scheduleRetry = useCallback(() => {
    if (retryBlockedRef.current) return;
    retryBlockedRef.current = true;
    const delay = Math.min(1000 * 2 ** attempt, 10_000);
    retryTimerRef.current = window.setTimeout(() => {
      retryBlockedRef.current = false;
      setAttempt((value) => value + 1);
    }, delay);
  }, [attempt]);

  useEffect(() => {
    const next = readStoredProfile(roomId);
    setNameState(next?.name ?? "");
    setAvatarState(next?.avatar ?? DEFAULT_AVATAR);
    setIsEditing(!next);
    setIsJoining(Boolean(next));
    setValidation("");
    setJoinError("");
    setAttempt(0);
    clearRetry();
    joinSentRef.current = false;
  }, [clearRetry, roomId]);

  useEffect(() => {
    if (isEditing || !isJoining || !roomId || isConnected) return;

    if (retryBlockedRef.current) return;
    let cancelled = false;
    void connect(roomId).then((ok) => {
      if (!cancelled && !ok) scheduleRetry();
    });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    connect,
    isConnected,
    isEditing,
    isJoining,
    roomId,
    scheduleRetry,
  ]);

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
        clearRetry();
        setAttempt(0);
        setIsJoining(false);
        setJoinError("");
        return;
      }
      joinSentRef.current = false;
      if (outcome === "rejected") {
        clearRetry();
        setJoinError(
          "ورود به این جلسه پذیرفته نشد. نام یا آواتار را بررسی کنید و دوباره تلاش کنید.",
        );
        setIsEditing(true);
        setIsJoining(false);
        return;
      }
      scheduleRetry();
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
    attempt,
    scheduleRetry,
    clearRetry,
  ]);

  useEffect(() => {
    if (!lastJoinResult) return;
    saveStoredProfile({
      room_id: roomId,
      name: lastJoinResult.displayName,
      avatar: lastJoinResult.avatar || DEFAULT_AVATAR,
      user_id: lastJoinResult.clientUserId,
    });
  }, [lastJoinResult, roomId]);

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
    clearRetry();
    setAttempt(0);
    setIsEditing(false);
    setIsJoining(true);
  };

  const retryNow = () => {
    joinSentRef.current = false;
    clearRetry();
    setJoinError("");
    setValidation("");
    setIsEditing(false);
    setIsJoining(true);
    setAttempt((value) => value + 1);
  };

  const editProfile = () => {
    joinSentRef.current = false;
    clearRetry();
    setJoinError("");
    setIsJoining(false);
    setIsEditing(true);
  };

  return {
    name,
    avatar,
    isEditing,
    isConnected,
    isStreamConnected,
    isJoining,
    validation,
    joinError,
    connectionError,
    setName,
    setAvatar,
    submitProfile,
    retryNow,
    editProfile,
  };
}
