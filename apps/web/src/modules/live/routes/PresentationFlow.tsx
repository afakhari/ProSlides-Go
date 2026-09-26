import { useEffect } from "react";

import Waiting from "../ui/WaitingScreen.tsx";
import { useManagerPresentationController } from "../manager/useManagerPresentationController.ts";
import { hasLeaderboardEntries } from "../model/leaderboard.ts";
import type { AppPresentationProps } from "../model/presentation.ts";
import { usePlayerSessionRecovery } from "../participant/usePlayerSessionRecovery.ts";
import { useAudio } from "../react/AudioProvider.tsx";
import { useLiveSession } from "../react/useLiveSession.ts";
import { useServerData } from "../react/useServerData.ts";
import { ManagerPresentationView } from "./ManagerPresentationView.tsx";
import { PlayerPresentationView } from "./PlayerPresentationView.tsx";
import { PresentationErrorBoundary } from "./PresentationErrorBoundary.tsx";
import { useLivePresentationModel } from "./useLivePresentationModel.ts";

export function AppPresentation({
  roomId,
  role,
  initialQuizData = null,
}: AppPresentationProps) {
  const {
    isConnected,
    connect,
    joinParticipant,
    snapshot,
    connectionError,
  } = useLiveSession();

  useEffect(() => {
    if (role !== "manager" || !roomId || snapshot?.role === "manager") return;

    let cancelled = false;
    let retry = 750;
    let timer = 0;
    let wake: (() => void) | null = null;

    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        wake = resolve;
        timer = window.setTimeout(() => {
          timer = 0;
          wake = null;
          resolve();
        }, milliseconds);
      });

    void (async () => {
      while (!cancelled) {
        const connected = await connect(roomId);
        if (cancelled || connected) return;
        await wait(retry);
        retry = Math.min(retry * 2, 10_000);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      wake?.();
    };
  }, [role, roomId, snapshot?.role, connect]);

  const { remoteQuiz, quiz, isRemoteReady } = useLivePresentationModel({
    roomId,
    role,
    initialQuizData,
    snapshot,
  });

  const { setQuizMusic } = useAudio();
  useEffect(() => {
    setQuizMusic(remoteQuiz?.music_url ?? "");
  }, [remoteQuiz?.music_url, setQuizMusic]);

  const {
    currentQuestion,
    currentContent,
    leaderboardResults,
    modalLeaderboardResults,
    questionResults,
  } = useServerData();
  const hasLeaderboard = hasLeaderboardEntries(leaderboardResults);

  const playerRecovery = usePlayerSessionRecovery({
    enabled: role === "player",
    roomId,
    currentQuestion,
    currentContent,
    hasLeaderboard,
    isConnected,
    connect,
    joinParticipant,
  });

  const managerController = useManagerPresentationController({
    enabled: role === "manager",
    quiz,
    currentQuestion,
    currentContent,
    isConnected,
    sessionState: snapshot?.session?.state,
    sessionStageView: snapshot?.session?.stage_view,
    activeItemId: snapshot?.session?.active_item_id ?? null,
  });

  if (role === "manager") {
    if (snapshot?.role !== "manager") {
      return (
        <Waiting
          message={
            connectionError
              ? "ارتباط با جلسه برقرار نشد؛ در حال تلاش دوباره…"
              : "در حال آماده‌سازی جلسه…"
          }
        />
      );
    }

    return (
      <PresentationErrorBoundary key={`manager-${roomId ?? "unknown"}`}>
        <ManagerPresentationView
          roomId={roomId}
          quiz={quiz}
          controller={managerController}
          isRemoteReady={isRemoteReady}
          currentContent={currentContent}
          leaderboardResults={leaderboardResults}
          modalLeaderboardResults={modalLeaderboardResults}
        />
      </PresentationErrorBoundary>
    );
  }

  if (role === "player") {
    return (
      <PresentationErrorBoundary key={`player-${roomId ?? "unknown"}`}>
        <PlayerPresentationView
          roomId={roomId}
          quiz={quiz}
          currentQuestion={currentQuestion}
          currentContent={currentContent}
          questionResults={questionResults}
          snapshot={snapshot}
          hasLeaderboard={hasLeaderboard}
          hasSeenActiveSlide={playerRecovery.hasSeenActiveSlide}
          lastActive={playerRecovery.lastActive}
        />
      </PresentationErrorBoundary>
    );
  }

  return <Waiting message="" />;
}
