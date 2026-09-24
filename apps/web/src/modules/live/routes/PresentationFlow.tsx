import { useEffect } from "react";

import Waiting from "../../../pages/loading/LoadingPage";
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
    lastJoinResult,
    sessionId: liveSessionId,
  } = useLiveSession();

  useEffect(() => {
    if (role !== "manager" || !roomId || liveSessionId) return;
    void connect(roomId);
  }, [role, roomId, liveSessionId, connect]);

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
    questionResults,
    partialQuestionResults,
    modalLeaderboardResults,
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
    lastJoinResult,
  });

  const managerController = useManagerPresentationController({
    enabled: role === "manager",
    quiz,
    currentQuestion,
    currentContent,
    leaderboardResults,
    isConnected,
    sessionState: snapshot?.session?.state,
  });

  if (role === "manager") {
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
          partialQuestionResults={partialQuestionResults}
          snapshot={snapshot}
          hasLeaderboard={hasLeaderboard}
          hasSeenActiveSlide={playerRecovery.hasSeenActiveSlide}
          lastActive={playerRecovery.lastActive}
          profile={playerRecovery.profile}
        />
      </PresentationErrorBoundary>
    );
  }

  return <Waiting message="" />;
}
