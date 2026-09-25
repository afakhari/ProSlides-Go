import { useEffect, useMemo, useRef, useState } from "react";

import { getColorForUser } from "../../../../shared/lib/playerColor.ts";
import { isQuestionSlide } from "../../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../../model/questionTimer.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { ManagerControls } from "./ManagerControls.tsx";
import { ManagerLeaderboardDialog } from "./ManagerLeaderboardDialog.tsx";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { ManagerStageProps } from "./types.ts";

type ManagerQuestionProps = ManagerStageProps & {
  isRemoteReady: boolean;
};

type TimerState = {
  remaining: number;
  anchorStartMs: number;
  totalSeconds: number;
};

export function ManagerPickAnswerQuestion({
  roomId,
  currentSlide,
  totalSlides,
  quiz,
  isRemoteReady,
  onEndGame,
}: ManagerQuestionProps) {
  const { isConnected, sendNavigation, sendEnd, snapshot } = useLiveSession();
  const {
    questionResults,
    modalLeaderboardResults,
    currentQuestion: liveCurrentQuestion,
  } = useServerData();
  const [showQr, setShowQr] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const slide = quiz.slides[currentSlide - 1];
  const currentQuestion: LegacyQuestionSlide | null =
    isRemoteReady && isQuestionSlide(slide) ? slide : null;

  const liveMatchesDefinition =
    currentQuestion?.question_id != null &&
    liveCurrentQuestion?.question_id != null &&
    String(currentQuestion.question_id) ===
      String(liveCurrentQuestion.question_id);

  const timerRunId = liveMatchesDefinition
    ? liveCurrentQuestion?.run_id ?? currentQuestion?.run_id
    : currentQuestion?.run_id;
  const timerRemainingSeconds = liveMatchesDefinition
    ? liveCurrentQuestion?.remaining_seconds ??
      currentQuestion?.remaining_seconds
    : currentQuestion?.remaining_seconds;
  const timerIdentity =
    currentQuestion?.question_id == null
      ? null
      : `${String(currentQuestion.question_id)}:${String(timerRunId ?? "na")}`;
  const activeTimerIdentityRef = useRef<string | null>(null);

  const [timerState, setTimerState] = useState<TimerState>({
    remaining: 0,
    anchorStartMs: Date.now(),
    totalSeconds: 0,
  });

  useEffect(() => {
    if (!currentQuestion || !timerIdentity) {
      activeTimerIdentityRef.current = null;
      setTimerState({
        remaining: 0,
        anchorStartMs: Date.now(),
        totalSeconds: 0,
      });
      return;
    }

    // Presence/roster updates may project a fresh question object with a stale
    // remaining_seconds value. The timer anchor belongs to the question run,
    // so preserve it until the run identity actually changes.
    if (activeTimerIdentityRef.current === timerIdentity) return;

    const resolved = resolveQuestionTimer({
      question: {
        ...currentQuestion,
        run_id: timerRunId,
        remaining_seconds: timerRemainingSeconds,
      },
      roomId,
      role: "manager",
    });
    activeTimerIdentityRef.current = timerIdentity;
    setTimerState({
      remaining: resolved.remainingSeconds,
      anchorStartMs: resolved.anchorStartMs,
      totalSeconds: resolved.totalSeconds,
    });
  }, [
    currentQuestion,
    roomId,
    timerIdentity,
    timerRemainingSeconds,
    timerRunId,
  ]);

  const resultMatches =
    currentQuestion?.question_id != null &&
    questionResults?.question_id != null &&
    String(currentQuestion.question_id) === String(questionResults.question_id);

  const resultOptions = useMemo(
    () => (resultMatches ? questionResults?.optionsResult ?? [] : []),
    [questionResults, resultMatches],
  );

  const options = useMemo(
    () => currentQuestion?.options ?? [],
    [currentQuestion],
  );
  const votes = useMemo(
    () =>
      options.map((option) => {
        const result = resultOptions.find(
          (candidate) =>
            String(candidate.option_id) === String(option.option_id),
        );
        return Number(result?.number_of_submits ?? 0);
      }),
    [options, resultOptions],
  );

  const showResults = resultMatches && resultOptions.length > 0;
  const totalVotes = votes.reduce((sum, count) => sum + count, 0);

  useEffect(() => {
    if (!currentQuestion || showResults || timerState.totalSeconds <= 0) return;

    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - timerState.anchorStartMs) / 1000;
      setTimerState((current) => ({
        ...current,
        remaining: Math.max(0, current.totalSeconds - elapsed),
      }));
    }, 250);

    return () => window.clearInterval(interval);
  }, [
    currentQuestion,
    showResults,
    timerState.anchorStartMs,
    timerState.totalSeconds,
  ]);

  const handleNext = async () => {
    if (!currentQuestion) return;

    const phase = snapshot?.session.activity_phase ?? null;
    if (phase === "accepting" || phase === "closed") {
      await sendNavigation("next");
      return;
    }

    const nextSlide = quiz.slides[currentSlide];

    if (currentQuestion.show_leaderboard_after) {
      await sendNavigation("next");
      return;
    }

    if (!nextSlide) {
      if (await sendEnd()) onEndGame();
      return;
    }

    if (await sendNavigation("next", { slide: nextSlide })) {
      // The authoritative snapshot will move the controller to the next item.
    }
  };

  const handleEnd = async () => {
    if (await sendEnd()) onEndGame();
  };

  const theme = participantTheme(quiz);
  const awaitingResults =
    currentQuestion !== null &&
    timerState.remaining <= 0 &&
    !showResults;

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-cover bg-center text-[color:var(--live-fg)]"
      style={theme.style}
    >
      <ManagerTopBar
        accessCode={quiz.access_code}
        isConnected={isConnected}
        qrOpen={showQr}
        onQrToggle={() => setShowQr((value) => !value)}
      />
      <ManagerQrPanel
        accessCode={quiz.access_code}
        isOpen={showQr}
        onClose={() => setShowQr(false)}
      />

      <main
        className={`flex min-h-screen flex-col px-4 pb-24 pt-20 transition-[padding] sm:px-6 ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        {!currentQuestion ? (
          <div
            className="m-auto rounded-2xl border border-white/10 bg-[color:var(--live-surface)] px-6 py-5 text-center text-lg font-bold"
            role="status"
          >
            در حال آماده‌سازی سؤال…
          </div>
        ) : (
          <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
            <div className="shrink-0 pt-4 text-center">
              <p className="text-sm text-[color:var(--live-muted)]">
                سؤال {currentSlide.toLocaleString("fa-IR")} از{" "}
                {totalSlides.toLocaleString("fa-IR")}
              </p>
              <h1
                className="mx-auto mt-2 max-w-5xl text-3xl font-black leading-tight sm:text-5xl"
                dir="auto"
              >
                {currentQuestion.question_text}
              </h1>
            </div>

            {awaitingResults ? (
              <div
                className="mx-auto mt-4 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm"
                role="status"
                aria-live="polite"
              >
                در انتظار نتیجه نهایی سرور…
              </div>
            ) : !showResults && timerState.remaining > 0 ? (
              <div
                className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-full border-4 border-white/15 bg-black/20 text-3xl font-black"
                role="timer"
                aria-label="زمان باقی‌مانده"
              >
                {Math.ceil(timerState.remaining).toLocaleString("fa-IR")}
              </div>
            ) : null}

            <div className="mt-6 flex min-h-0 flex-1 gap-5 overflow-hidden">
              {currentQuestion.image_url ? (
                <div className="hidden w-1/4 shrink-0 items-center justify-center lg:flex">
                  <img
                    src={currentQuestion.image_url}
                    alt="تصویر سؤال"
                    className="max-h-[58dvh] max-w-full rounded-2xl object-contain shadow-xl"
                  />
                </div>
              ) : null}

              <div className="flex min-w-0 flex-1 items-end gap-3 overflow-x-auto pb-4 sm:gap-5">
                {options.map((option, index) => {
                  const correct = option.answer === true;
                  const count = votes[index] ?? 0;
                  const height =
                    showResults && totalVotes > 0
                      ? Math.max(6, (count / totalVotes) * 100)
                      : 0;
                  const color = getColorForUser(option.option_id);

                  return (
                    <article
                      key={option.option_id}
                      className="flex h-[52dvh] min-w-36 flex-1 flex-col items-center justify-end"
                    >
                      {showResults ? (
                        <p className="mb-2 text-2xl font-black">
                          {count.toLocaleString("fa-IR")}
                        </p>
                      ) : null}
                      {option.image_url ? (
                        <img
                          src={option.image_url}
                          alt={option.option_text}
                          className="mb-2 max-h-28 max-w-full rounded-xl object-contain"
                        />
                      ) : null}
                      <div className="flex h-full w-full items-end">
                        <div
                          className={`w-full rounded-t-2xl transition-[height] duration-700 ${
                            showResults
                              ? correct
                                ? "bg-success"
                                : "bg-danger/80"
                              : "bg-white/10"
                          }`}
                          style={{
                            height: showResults ? `${height}%` : "8%",
                            backgroundColor: showResults ? undefined : color,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                      <p
                        className="mt-3 min-h-14 text-center text-base font-bold sm:text-lg"
                        dir="auto"
                      >
                        {option.option_text}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      <ManagerControls
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onNext={currentQuestion ? handleNext : undefined}
        onEnd={handleEnd}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        endOnLastSlide={false}
      />

      <ManagerLeaderboardDialog
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        players={modalLeaderboardResults ?? []}
      />
    </div>
  );
}
