import { useNavigate } from "react-router-dom";

import Waiting from "../../../pages/loading/LoadingPage";
import type { ManagerPresentationController } from "../manager/useManagerPresentationController.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type { LegacyContentSlide, LegacyLiveUser } from "../model/serverData.ts";
import { ManagerContentSlide } from "../manager/ui/ManagerContentSlide.tsx";
import { ManagerFinalLeaderboard } from "../manager/ui/ManagerFinalLeaderboard.tsx";
import { ManagerJoinPage } from "../manager/ui/ManagerJoinPage.tsx";
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
    handlePrevious,
    handleEndGame,
  } = controller;

  if (!isSynced) {
    return <Waiting message="در حال همگام‌سازی جلسه…" />;
  }

  const sharedProps = {
    roomId,
    onNext: handleNext,
    onPrevious: handlePrevious,
    currentSlide,
    totalSlides,
    quiz,
    onEndGame: handleEndGame,
  };

  switch (view) {
    case "ManagerJoinPage":
      return <ManagerJoinPage {...sharedProps} />;
    case "ManagerPickAnswerQuestion":
      return (
        <ManagerPickAnswerQuestion
          {...sharedProps}
          isRemoteReady={isRemoteReady}
        />
      );
    case "ManagerLeaderBoard":
      return (
        <ManagerLeaderBoard
          {...sharedProps}
          isRemoteReady={isRemoteReady}
        />
      );
    case "ManagerContentSlide":
      return (
        <ManagerContentSlide
          {...sharedProps}
          content={currentContent}
        />
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
