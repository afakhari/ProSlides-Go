import { lazy, Suspense } from "react";

import { matchingQuestionResult, type PlayerLastActive } from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import type { StoredPlayerProfile } from "../model/playerProfileStorage.ts";
import type { LiveSnapshot } from "../api/types.ts";
import { PlayerSyncState } from "../participant/ui/PlayerSyncState.tsx";

const PlayerContentSlide = lazy(() =>
  import("../participant/ui/PlayerContentSlide.tsx").then((module) => ({
    default: module.PlayerContentSlide,
  })),
);
const PlayerFinalResult = lazy(() =>
  import("../participant/ui/PlayerFinalResult.tsx").then((module) => ({
    default: module.PlayerFinalResult,
  })),
);
const PlayerJoinPage = lazy(() =>
  import("../participant/ui/PlayerJoinPage.tsx").then((module) => ({
    default: module.PlayerJoinPage,
  })),
);
const PlayerLeaderBoard = lazy(() =>
  import("../participant/ui/PlayerLeaderBoard.tsx").then((module) => ({
    default: module.PlayerLeaderBoard,
  })),
);
const PlayerPickAnswerQuestion = lazy(() =>
  import("../participant/ui/PlayerPickAnswerQuestion.tsx").then((module) => ({
    default: module.PlayerPickAnswerQuestion,
  })),
);
type PlayerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  questionResults: LegacyQuestionResult | null;
  partialQuestionResults: LegacyQuestionResult | null;
  snapshot: LiveSnapshot | null;
  hasLeaderboard: boolean;
  hasSeenActiveSlide: boolean;
  lastActive: PlayerLastActive | null;
  profile: StoredPlayerProfile | null;
};

function PlayerPresentationContent({
  roomId,
  quiz,
  currentQuestion,
  currentContent,
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
      <PlayerContentSlide quiz={quiz} content={currentContent} />
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

  if (snapshot?.session?.state === "ended") {
    return <PlayerFinalResult quiz={quiz} />;
  }

  if (hasLeaderboard) {
    return <PlayerLeaderBoard quiz={quiz} />;
  }

  if (snapshot?.session?.state === "question_closed" && profile) {
    return (
      <PlayerSyncState
        quiz={quiz}
        title="پاسخ‌ها بسته شد"
        message="نتیجه این مرحله در حال آماده‌سازی است."
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
    return (
      <PlayerSyncState
        quiz={quiz}
        title="در حال همگام‌سازی جلسه"
        message="اتصال و وضعیت آخرین اسلاید در حال بازیابی است."
      />
    );
  }

  return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
}


export function PlayerPresentationView(props: PlayerViewProps) {
  return (
    <Suspense
      fallback={
        <PlayerSyncState
          quiz={props.quiz}
          title="در حال آماده‌سازی نمایش"
          message="نمای مناسب وضعیت فعلی جلسه در حال بارگذاری است."
        />
      }
    >
      <PlayerPresentationContent {...props} />
    </Suspense>
  );
}
