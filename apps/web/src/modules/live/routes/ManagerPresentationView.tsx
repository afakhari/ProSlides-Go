import { lazy, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";

import Waiting from "../../../pages/loading/LoadingPage";
import type { ManagerPresentationController } from "../manager/useManagerPresentationController.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type { LegacyContentSlide, LegacyLiveUser } from "../model/serverData.ts";

type ManagerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  controller: ManagerPresentationController;
  isRemoteReady: boolean;
  currentContent: LegacyContentSlide | null;
  leaderboardResults: LegacyLiveUser[] | null;
  modalLeaderboardResults: LegacyLiveUser[] | null;
};

type LegacyManagerPageProps = Record<string, unknown>;

const ManagerJoinPage = lazy(
  () =>
    import("../../../pages/presentation/manager/JoinPage") as Promise<{
      default: ComponentType<LegacyManagerPageProps>;
    }>,
);
const ManagerPickAnswerQuestion = lazy(
  () =>
    import("../../../pages/presentation/manager/PickAnswerQuestion") as Promise<{
      default: ComponentType<LegacyManagerPageProps>;
    }>,
);
const ManagerLeaderBoard = lazy(
  () =>
    import("../../../pages/presentation/manager/LeaderBoard") as Promise<{
      default: ComponentType<LegacyManagerPageProps>;
    }>,
);
const ManagerContentSlide = lazy(
  () =>
    import("../../../pages/presentation/manager/ContentSlide") as Promise<{
      default: ComponentType<LegacyManagerPageProps>;
    }>,
);
const FinalLeaderboard = lazy(
  () =>
    import("../../../pages/presentation/manager/FinalLeaderboard") as Promise<{
      default: ComponentType<LegacyManagerPageProps>;
    }>,
);

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
        <FinalLeaderboard
          leaderboardData={modalLeaderboardResults ?? leaderboardResults}
          quiz={quiz}
          onExit={() => navigate("/manager/panel")}
        />
      );
    default:
      return <Waiting />;
  }
}
