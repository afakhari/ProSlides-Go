import type { PlayerLastActive } from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import { ParticipantActivityResult } from "../participant/ui/ParticipantActivityResult.tsx";
import { ParticipantContentSlide } from "../participant/ui/ParticipantContentSlide.tsx";
import { ParticipantFinalResult } from "../participant/ui/ParticipantFinalResult.tsx";
import { ParticipantJoinPage } from "../participant/ui/ParticipantJoinPage.tsx";
import { ParticipantLeaderboard } from "../participant/ui/ParticipantLeaderboard.tsx";
import { ParticipantQuestion } from "../participant/ui/ParticipantQuestion.tsx";
import { ParticipantWordCloud } from "../participant/ui/ParticipantWordCloud.tsx";
import { ParticipantWaiting } from "../participant/ui/ParticipantWaiting.tsx";
import type { LiveSnapshot } from "../api/types.ts";

type PlayerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  questionResults: LegacyQuestionResult | null;
  snapshot: LiveSnapshot | null;
  hasLeaderboard: boolean;
  hasSeenActiveSlide: boolean;
  lastActive: PlayerLastActive | null;
};

export function PlayerPresentationView({
  roomId,
  quiz,
  currentQuestion,
  currentContent,
  questionResults,
  snapshot,
  hasLeaderboard,
  hasSeenActiveSlide,
  lastActive,
}: PlayerViewProps) {
  if (currentContent) {
    return (
      <ParticipantContentSlide
        quiz={quiz}
        content={currentContent}
      />
    );
  }

  if (
    currentQuestion &&
    snapshot?.role === "participant" &&
    snapshot.session.activity_phase === "revealed"
  ) {
    return (
      <ParticipantActivityResult
        quiz={quiz}
        question={currentQuestion}
        result={questionResults}
      />
    );
  }

  if (currentQuestion) {
    return currentQuestion.activity_kind === "text" ? (
      <ParticipantWordCloud
        roomId={roomId}
        question={currentQuestion}
        quiz={quiz}
      />
    ) : (
      <ParticipantQuestion
        roomId={roomId}
        question={currentQuestion}
        quiz={quiz}
      />
    );
  }

  if (
    snapshot?.role === "participant" &&
    snapshot.session.state === "ended"
  ) {
    return <ParticipantFinalResult quiz={quiz} />;
  }

  if (hasLeaderboard) {
    return <ParticipantLeaderboard quiz={quiz} />;
  }

  if (
    hasSeenActiveSlide &&
    lastActive?.kind === "question" &&
    snapshot?.session?.state === "presenting" &&
    snapshot.session.activity_phase === "accepting"
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
      return fallbackQuestion.activity_kind === "text" ? (
        <ParticipantWordCloud
          roomId={roomId}
          question={fallbackQuestion}
          quiz={quiz}
        />
      ) : (
        <ParticipantQuestion
          roomId={roomId}
          question={fallbackQuestion}
          quiz={quiz}
        />
      );
    }
  }

  if (hasSeenActiveSlide) {
    return <ParticipantWaiting quiz={quiz} />;
  }

  return <ParticipantJoinPage roomId={roomId} quiz={quiz} />;
}
