import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearLegacyParticipantArtifacts,
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

type UsePlayerSessionRecoveryOptions = {
  enabled: boolean;
  roomId?: string;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  hasLeaderboard: boolean;
  isConnected: boolean;
  connect: LiveSessionContextValue["connect"];
  joinParticipant: LiveSessionContextValue["joinParticipant"];
};

type PlayerSessionRecovery = {
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
}: UsePlayerSessionRecoveryOptions): PlayerSessionRecovery {
  const [hasSeenActiveSlide, setHasSeenActiveSlide] = useState(
    () => enabled && readPlayerSeenActive(roomId),
  );
  const [lastActive, setLastActive] = useState<PlayerLastActive | null>(
    () => (enabled ? readPlayerLastActive(roomId) : null),
  );
  const joinSentRef = useRef(false);

  const profile = useMemo(
    () => (enabled ? readStoredProfile(roomId) : null),
    [enabled, roomId],
  );

  useEffect(() => {
    if (enabled) clearLegacyParticipantArtifacts(roomId);
  }, [enabled, roomId]);

  useEffect(() => {
    if (!enabled) {
      setHasSeenActiveSlide(false);
      setLastActive(null);
      joinSentRef.current = false;
      return;
    }

    setHasSeenActiveSlide(readPlayerSeenActive(roomId));
    setLastActive(readPlayerLastActive(roomId));
  }, [enabled, roomId]);

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
    if (!shouldAutoResume || !roomId || isConnected) return;

    void connect(roomId).catch((error: unknown) => {
      console.error("[PresentationFlow] player resume connect failed:", error);
    });
  }, [shouldAutoResume, roomId, isConnected, connect]);

  useEffect(() => {
    if (!shouldAutoResume || !isConnected || !profile) {
      joinSentRef.current = false;
      return;
    }

    if (joinSentRef.current) return;
    joinSentRef.current = true;

    void joinParticipant({
      name: profile.name,
      avatar: profile.avatar,
      clientUserId: getPersistedUserIdForRoom(roomId) ?? undefined,
    }).then((ok) => {
      if (ok !== true) joinSentRef.current = false;
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
