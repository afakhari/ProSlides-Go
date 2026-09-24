import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_AVATAR,
  getPersistedUserIdForRoom,
  readStoredProfile,
  type StoredPlayerProfile,
} from "../model/playerProfileStorage.ts";
import {
  persistPlayerLastActive,
  persistPlayerSeenActive,
  readPlayerLastActive,
  readPlayerSeenActive,
  type PlayerLastActive,
} from "../model/presentationFlow.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import type { LiveSessionContextValue } from "../react/liveSessionContext.ts";
import type { LiveJoinResult } from "../runtime/LiveRuntime.ts";

type UsePlayerSessionRecoveryOptions = {
  enabled: boolean;
  roomId?: string;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  hasLeaderboard: boolean;
  isConnected: boolean;
  connect: LiveSessionContextValue["connect"];
  joinParticipant: LiveSessionContextValue["joinParticipant"];
  lastJoinResult: LiveJoinResult | null;
};

export type PlayerSessionRecovery = {
  hasSeenActiveSlide: boolean;
  lastActive: PlayerLastActive | null;
  profile: StoredPlayerProfile | null;
  shouldAutoResume: boolean;
};

export function usePlayerSessionRecovery({
  enabled,
  roomId,
  currentQuestion,
  currentContent,
  hasLeaderboard,
  isConnected,
  connect,
  joinParticipant,
  lastJoinResult,
}: UsePlayerSessionRecoveryOptions): PlayerSessionRecovery {
  const [hasSeenActiveSlide, setHasSeenActiveSlide] = useState(
    () => enabled && readPlayerSeenActive(roomId),
  );
  const [lastActive, setLastActive] = useState<PlayerLastActive | null>(
    () => (enabled ? readPlayerLastActive(roomId) : null),
  );
  const joinSentRef = useRef(false);
  const resumeJoinPendingRef = useRef(false);
  const [profile, setProfile] = useState<StoredPlayerProfile | null>(
    () => (enabled ? readStoredProfile(roomId) : null),
  );

  useEffect(() => {
    if (!enabled) {
      setHasSeenActiveSlide(false);
      setLastActive(null);
      setProfile(null);
      joinSentRef.current = false;
      resumeJoinPendingRef.current = false;
      return;
    }

    setHasSeenActiveSlide(readPlayerSeenActive(roomId));
    setLastActive(readPlayerLastActive(roomId));
    setProfile(readStoredProfile(roomId));
    joinSentRef.current = false;
    resumeJoinPendingRef.current = false;
  }, [enabled, roomId]);

  useEffect(() => {
    if (!enabled || !lastJoinResult) return;

    setProfile({
      room_id: String(roomId ?? ""),
      name: lastJoinResult.displayName,
      avatar: lastJoinResult.avatar || DEFAULT_AVATAR,
      user_id: lastJoinResult.clientUserId,
    });
  }, [enabled, lastJoinResult, roomId]);

  useEffect(() => {
    if (!enabled) return;

    if (currentQuestion || currentContent) {
      setHasSeenActiveSlide(true);
      persistPlayerSeenActive(roomId);
    }

    if (currentQuestion) {
      const active: PlayerLastActive = {
        kind: "question",
        payload: currentQuestion,
        updatedAt: Date.now(),
      };
      setLastActive(active);
      persistPlayerLastActive(roomId, active);
      return;
    }

    if (currentContent) {
      const active: PlayerLastActive = {
        kind: "content",
        payload: currentContent,
        updatedAt: Date.now(),
      };
      setLastActive(active);
      persistPlayerLastActive(roomId, active);
    }
  }, [enabled, roomId, currentQuestion, currentContent]);

  const shouldAutoResume =
    enabled &&
    !!profile &&
    hasSeenActiveSlide &&
    !currentQuestion &&
    !currentContent &&
    !hasLeaderboard;

  useEffect(() => {
    if (!shouldAutoResume) {
      resumeJoinPendingRef.current = false;
      joinSentRef.current = false;
      return;
    }
    if (!roomId || isConnected) return;

    resumeJoinPendingRef.current = true;
    void connect(roomId)
      .then((ok) => {
        if (ok !== true) {
          resumeJoinPendingRef.current = false;
        }
      })
      .catch((error: unknown) => {
        resumeJoinPendingRef.current = false;
        console.error("[PresentationFlow] player resume connect failed:", error);
      });
  }, [shouldAutoResume, roomId, isConnected, connect]);

  useEffect(() => {
    if (!shouldAutoResume || !profile) {
      joinSentRef.current = false;
      resumeJoinPendingRef.current = false;
      return;
    }
    if (!isConnected || !resumeJoinPendingRef.current) return;

    if (joinSentRef.current) return;
    joinSentRef.current = true;

    void joinParticipant({
      name: profile.name,
      avatar: profile.avatar,
      clientUserId: getPersistedUserIdForRoom(roomId) ?? undefined,
    }).then((ok) => {
      if (ok === true) {
        resumeJoinPendingRef.current = false;
        return;
      }

      joinSentRef.current = false;
      if (ok === "rejected") {
        resumeJoinPendingRef.current = false;
      }
    });
  }, [
    shouldAutoResume,
    isConnected,
    profile,
    roomId,
    joinParticipant,
  ]);

  return {
    hasSeenActiveSlide,
    lastActive,
    profile,
    shouldAutoResume,
  };
}
