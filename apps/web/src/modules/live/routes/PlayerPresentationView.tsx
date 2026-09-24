import type { PlayerLastActive } from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import { ParticipantContentSlide } from "../participant/ui/ParticipantContentSlide.tsx";
import { ParticipantFinalResult } from "../participant/ui/ParticipantFinalResult.tsx";
import { ParticipantJoinPage } from "../participant/ui/ParticipantJoinPage.tsx";
import { ParticipantLeaderboard } from "../participant/ui/ParticipantLeaderboard.tsx";
import { ParticipantQuestion } from "../participant/ui/ParticipantQuestion.tsx";
import { ParticipantWaiting } from "../participant/ui/ParticipantWaiting.tsx";
import type { LiveSnapshot } from "../api/types.ts";

type PlayerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
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

  if (currentQuestion) {
    return (
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
