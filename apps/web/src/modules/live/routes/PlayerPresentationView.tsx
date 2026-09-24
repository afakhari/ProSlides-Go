import { lazy, type ComponentType } from "react";

import Waiting from "../../../pages/loading/LoadingPage";
import { matchingQuestionResult, type PlayerLastActive } from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type {
  LegacyContentSlide,
  LegacyLiveUser,
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import type { StoredPlayerProfile } from "../model/playerProfileStorage.ts";
import type { LiveSnapshot } from "../api/types.ts";

type PlayerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  leaderboardResults: LegacyLiveUser[] | null;
  questionResults: LegacyQuestionResult | null;
  partialQuestionResults: LegacyQuestionResult | null;
  snapshot: LiveSnapshot | null;
  hasLeaderboard: boolean;
  hasSeenActiveSlide: boolean;
  lastActive: PlayerLastActive | null;
  profile: StoredPlayerProfile | null;
};

type LegacyPlayerPageProps = Record<string, unknown>;

const PlayerJoinPage = lazy(
  () =>
    import("../../../pages/presentation/player/JoinPage") as Promise<{
      default: ComponentType<LegacyPlayerPageProps>;
    }>,
);
const PlayerPickAnswerQuestion = lazy(
  () =>
    import("../../../pages/presentation/player/PickAnswerQuestion") as Promise<{
      default: ComponentType<LegacyPlayerPageProps>;
    }>,
);
const PlayerLeaderBoard = lazy(
  () =>
    import("../../../pages/presentation/player/LeaderBoard") as Promise<{
      default: ComponentType<LegacyPlayerPageProps>;
    }>,
);
const PlayerContentSlide = lazy(
  () =>
    import("../../../pages/presentation/player/ContentSlide") as Promise<{
      default: ComponentType<LegacyPlayerPageProps>;
    }>,
);

export function PlayerPresentationView({
  roomId,
  quiz,
  currentQuestion,
  currentContent,
  leaderboardResults,
  questionResults,
  partialQuestionResults,
  snapshot,
  hasLeaderboard,
  hasSeenActiveSlide,
  lastActive,
  profile,
}: PlayerViewProps) {
  if (currentContent) {
    return (
      <PlayerContentSlide
        roomId={roomId}
        quiz={quiz}
        content={currentContent}
      />
    );
  }

  if (currentQuestion) {
    const result = matchingQuestionResult(
      currentQuestion,
      questionResults,
      partialQuestionResults,
    );
    return (
      <PlayerPickAnswerQuestion
        roomId={roomId}
        question={currentQuestion}
        result={result}
        quiz={quiz}
      />
    );
  }

  if (hasLeaderboard) {
    return (
      <PlayerLeaderBoard
        roomId={roomId}
        players={leaderboardResults ?? []}
        quiz={quiz}
      />
    );
  }

  if (
    hasSeenActiveSlide &&
    lastActive?.kind === "question" &&
    snapshot?.session?.state === "question_open"
  ) {
    const freshRemaining = snapshot.session.remaining_seconds;
    const fallbackQuestion =
      freshRemaining == null
        ? lastActive.payload
        : {
            ...lastActive.payload,
            remaining_seconds: freshRemaining,
          };
    const fallbackTimer = resolveQuestionTimer({
      question: fallbackQuestion,
      roomId,
      role: "player",
    });

    if (
      fallbackTimer.totalSeconds > 0 &&
      fallbackTimer.remainingSeconds > 0
    ) {
      return (
        <PlayerPickAnswerQuestion
          roomId={roomId}
          question={fallbackQuestion}
          result={null}
          quiz={quiz}
        />
      );
    }
  }

  if (hasSeenActiveSlide && profile) {
    return <Waiting message="در حال همگام‌سازی جلسه…" />;
  }

  return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
}
