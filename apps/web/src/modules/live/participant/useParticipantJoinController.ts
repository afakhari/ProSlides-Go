import { useEffect, useMemo, useRef, useState } from "react";

import {
  createClientUserId,
  DEFAULT_AVATAR,
  getPersistedUserIdForRoom,
  readStoredProfile,
  saveStoredProfile,
} from "../model/playerProfileStorage.ts";
import { useLiveSession } from "../react/useLiveSession.ts";

type JoinStatus = "editing" | "connecting" | "joining" | "ready" | "rejected";

export type ParticipantJoinController = {
  name: string;
  avatar: string;
  status: JoinStatus;
  validation: string;
  isConnected: boolean;
  connectionError: string | null;
  setName: (value: string) => void;
  setAvatar: (value: string) => void;
  submitProfile: () => void;
  editProfile: () => void;
};

export function useParticipantJoinController(
  roomId?: string,
): ParticipantJoinController {
  const restored = useMemo(() => readStoredProfile(roomId), [roomId]);
  const [name, setNameState] = useState(restored?.name ?? "");
  const [avatar, setAvatar] = useState(restored?.avatar ?? DEFAULT_AVATAR);
  const [status, setStatus] = useState<JoinStatus>(
    restored ? "connecting" : "editing",
  );
  const [validation, setValidation] = useState("");
  const [retryEpoch, setRetryEpoch] = useState(0);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const joinInFlightRef = useRef(false);

  const {
    connect,
    joinParticipant,
    isConnected,
    lastJoinResult,
    connectionError,
  } = useLiveSession();

  useEffect(() => {
    setNameState(restored?.name ?? "");
    setAvatar(restored?.avatar ?? DEFAULT_AVATAR);
    setValidation("");
    setStatus(restored ? "connecting" : "editing");
    retryAttemptRef.current = 0;
    joinInFlightRef.current = false;
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [restored, roomId]);

  useEffect(() => {
    if (
      status === "editing" ||
      status === "rejected" ||
      status === "ready" ||
      !roomId ||
      isConnected
    ) {
      return;
    }

    let cancelled = false;
    setStatus("connecting");

    void connect(roomId).then((ok) => {
      if (cancelled || ok) return;
      const delay = Math.min(
        1000 * 2 ** retryAttemptRef.current,
        10_000,
      );
      retryAttemptRef.current += 1;
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setRetryEpoch((value) => value + 1);
      }, delay);
    });

    return () => {
      cancelled = true;
    };
  }, [connect, isConnected, retryEpoch, roomId, status]);

  useEffect(() => {
    if (
      status === "editing" ||
      status === "rejected" ||
      status === "ready" ||
      !isConnected ||
      joinInFlightRef.current
    ) {
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) return;

    joinInFlightRef.current = true;
    setStatus("joining");

    void joinParticipant({
      name: cleanName,
      avatar,
      clientUserId: getPersistedUserIdForRoom(roomId) ?? undefined,
    }).then((outcome) => {
      joinInFlightRef.current = false;

      if (outcome === true) {
        retryAttemptRef.current = 0;
        setStatus("ready");
        return;
      }

      if (outcome === "rejected") {
        setValidation(
          "ورود به جلسه پذیرفته نشد. نام دیگری انتخاب کنید یا دوباره تلاش کنید.",
        );
        setStatus("rejected");
        return;
      }

      setStatus("connecting");
    });
  }, [avatar, isConnected, joinParticipant, name, roomId, status]);

  useEffect(() => {
    if (!lastJoinResult) return;

    saveStoredProfile({
      room_id: roomId,
      name: lastJoinResult.displayName || name,
      avatar: lastJoinResult.avatar || avatar,
      user_id: lastJoinResult.clientUserId,
    });
  }, [avatar, lastJoinResult, name, roomId]);

  useEffect(
    () => () => {
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current);
      }
    },
    [],
  );

  const setName = (value: string) => {
    setNameState(value);
    setValidation("");
    if (status === "rejected") setStatus("editing");
  };

  const submitProfile = () => {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setValidation("نام شما باید حداقل دو نویسه داشته باشد.");
      return;
    }
    if (Array.from(cleanName).length > 40) {
      setValidation("نام نمایشی نمی‌تواند بیشتر از ۴۰ نویسه باشد.");
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
    retryAttemptRef.current = 0;
    setStatus(isConnected ? "joining" : "connecting");
  };

  const editProfile = () => {
    joinInFlightRef.current = false;
    setValidation("");
    setStatus("editing");
  };

  return {
    name,
    avatar,
    status,
    validation,
    isConnected,
    connectionError,
    setName,
    setAvatar,
    submitProfile,
    editProfile,
  };
}
