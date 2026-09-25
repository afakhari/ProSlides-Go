import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import Waiting from "../ui/WaitingScreen.tsx";
import type { ManagerPresentationController } from "../manager/useManagerPresentationController.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type { LegacyContentSlide, LegacyLiveUser } from "../model/serverData.ts";
import { ManagerContentSlide } from "../manager/ui/ManagerContentSlide.tsx";
import { ManagerFinalLeaderboard } from "../manager/ui/ManagerFinalLeaderboard.tsx";
import { ManagerJoinPage } from "../manager/ui/ManagerJoinPage.tsx";
import { ManagerBackstageDrawer } from "../manager/ui/ManagerBackstageDrawer.tsx";
import { ManagerLeaderBoard } from "../manager/ui/ManagerLeaderBoard.tsx";
import { ManagerPickAnswerQuestion } from "../manager/ui/ManagerPickAnswerQuestion.tsx";

type ManagerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  controller: ManagerPresentationController;
  isRemoteReady: boolean;
  currentContent: LegacyContentSlide | null;
  leaderboardResults: LegacyLiveUser[] | null;
  modalLeaderboardResults: LegacyLiveUser[] | null;
};

export function ManagerPresentationView({
  roomId,
  quiz,
  controller,
  isRemoteReady,
  currentContent,
  leaderboardResults,
  modalLeaderboardResults,
}: ManagerViewProps) {
  const navigate = useNavigate();
  const {
    view,
    currentSlide,
    totalSlides,
    isSynced,
    handleNext,
    handleEndGame,
  } = controller;

  if (!isSynced) {
    return <Waiting message="در حال همگام‌سازی جلسه…" />;
  }

  const stageProps = {
    roomId,
    onNext: handleNext,
    currentSlide,
    totalSlides,
    quiz,
    onEndGame: handleEndGame,
  };

  const withBackstage = (content: ReactNode) => (
    <>
      {content}
      {view !== "ManagerFinalLeaderboard" ? (
        <ManagerBackstageDrawer
          quiz={quiz}
          currentSlide={currentSlide}
          onAdvance={handleNext}
          onEndGame={handleEndGame}
        />
      ) : null}
    </>
  );

  switch (view) {
    case "ManagerJoinPage":
      return withBackstage(
        <ManagerJoinPage
          roomId={roomId}
          onNext={handleNext}
          quiz={quiz}
        />,
      );
    case "ManagerPickAnswerQuestion":
      return withBackstage(
        <ManagerPickAnswerQuestion
          {...stageProps}
          isRemoteReady={isRemoteReady}
        />,
      );
    case "ManagerLeaderBoard":
      return withBackstage(<ManagerLeaderBoard {...stageProps} />);
    case "ManagerContentSlide":
      return withBackstage(
        <ManagerContentSlide
          {...stageProps}
          content={currentContent}
        />,
      );
    case "ManagerFinalLeaderboard":
      return (
        <ManagerFinalLeaderboard
          leaderboardData={modalLeaderboardResults ?? leaderboardResults ?? []}
          quiz={quiz}
          onExit={() => navigate("/manager/panel")}
        />
      );
    default:
      return <Waiting message="" />;
  }
}
