import React, { lazy, useEffect, useState } from "react";

import { useAudio } from "../../../contexts/AudioContext.tsx";
import Waiting from "../../../pages/loading/LoadingPage";
import FinalLeaderboard from "../../../pages/presentation/manager/FinalLeaderboard";
import { getPresentation } from "../api/liveApi.ts";
import { hasLeaderboardEntries } from "../model/leaderboard.ts";
import {
  EMPTY_PRESENTATION,
  isContentSlide,
  isLeaderboardSlide,
  isQuestionSlide,
  matchingQuestionResult,
} from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import { usePlayerSessionRecovery } from "../participant/usePlayerSessionRecovery.ts";
import { useLiveSession } from "../react/useLiveSession.ts";
import { useServerData } from "../react/useServerData.ts";
import { presentationSlideToLegacy } from "../runtime/protocol.js";

const ManagerJoinPage = lazy(() =>
  import("../../../pages/presentation/manager/JoinPage")
);
const ManagerPickAnswerQuestion = lazy(() =>
  import("../../../pages/presentation/manager/PickAnswerQuestion")
);
const ManagerLeaderBoard = lazy(() =>
  import("../../../pages/presentation/manager/LeaderBoard")
);
const ManagerContentSlide = lazy(() =>
  import("../../../pages/presentation/manager/ContentSlide")
);
const PlayerJoinPage = lazy(() =>
  import("../../../pages/presentation/player/JoinPage")
);
const PlayerPickAnswerQuestion = lazy(() =>
  import("../../../pages/presentation/player/PickAnswerQuestion")
);
const PlayerLeaderBoard = lazy(() =>
  import("../../../pages/presentation/player/LeaderBoard")
);
const PlayerContentSlide = lazy(() =>
  import("../../../pages/presentation/player/ContentSlide")
);

/* ------------------------ Main Flow ------------------------ */
export function AppPresentation({ roomId, role, initialQuizData = null }) {
  const [data, setData] = useState({ type: "ManagerJoinPage" });
  const [currentSlide, setCurrentSlide] = useState(1);

  // Fetch full quiz once at top-level and transform to internal shape
  const [remoteQuiz, setRemoteQuiz] = useState(initialQuizData || null);

  // Initialize remoteQuiz with initialQuizData if available (for player)
  useEffect(() => {
    if (initialQuizData && role === "player") {
      // Handle potential flat structure or nested structure for background
      const rawBg = initialQuizData.background || {};
      const background = {
        color: rawBg.color || initialQuizData.background_color || "#1e1e2e",
        image:
          rawBg.image ||
          initialQuizData.background_image ||
          initialQuizData.background_image_url ||
          "",
      };

      setRemoteQuiz((prev) => prev || {
        quiz_id: initialQuizData.quiz_id,
        title: initialQuizData.title || "",
        access_code: initialQuizData.access_code || "",
        background: background,
        music_url: initialQuizData.music_url || "",
        slides: [], // Player doesn't need full slides initially
      });
    }
  }, [initialQuizData, role]);

  useEffect(() => {
    let mounted = true;
    const fetchQuiz = async () => {
      try {
        if (!roomId) return;

        // If we already have initial data for player, we might skip full fetch or do it in background
        // But if user wants ONLY this API for player, we skip fetch for player
        if (role === "player") return;

        const data = await getPresentation(roomId);
        if (!mounted) return;
        if (data && Array.isArray(data.slides)) {
          const mappedSlides = data.slides.map(presentationSlideToLegacy);
          const quizData = {
            quiz_id: data.id,
            title: data.title,
            access_code: data.access_code || "",
            background: {
              color: data.settings?.background_color || "#1e1e2e",
              image: data.settings?.background_image_url || "",
              text_color: data.settings?.text_color || "#111827",
            },
            music_url: data.settings?.music_url || "",
            slides: mappedSlides,
            text_color: data.settings?.text_color || "#111827",
          };

          setRemoteQuiz(quizData);
        }
      } catch (err) {
        console.error("[AppPresentation] could not load remote quiz", err);
      }
    };
    fetchQuiz();
    return () => {
      mounted = false;
    };
  }, [role, roomId, initialQuizData]);

  const {
    isConnected,
    connect,
    joinParticipant,
    snapshot,
    sessionId: liveSessionId,
  } = useLiveSession();
  useEffect(() => {
    if (role !== "manager" || !roomId || liveSessionId) return;
    void connect(roomId);
  }, [role, roomId, liveSessionId, connect]);
  const quiz = React.useMemo(() => {
    const baseQuiz = remoteQuiz ?? EMPTY_PRESENTATION;
    return snapshot?.role === "manager"
      ? { ...baseQuiz, access_code: snapshot.session.join_code }
      : baseQuiz;
  }, [remoteQuiz, snapshot]);
  const isRemoteReady = role === "player" || !!remoteQuiz;
  const totalSlides = quiz.slides.length;

  // Set quiz music when loaded
  const { setQuizMusic } = useAudio();
  useEffect(() => {
    setQuizMusic(remoteQuiz?.music_url || "");
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
  const {
    hasSeenActiveSlide: playerHasSeenActiveSlide,
    lastActive: playerLastActive,
    profile: playerResumeProfile,
  } = usePlayerSessionRecovery({
    enabled: role === "player",
    roomId,
    currentQuestion,
    currentContent,
    hasLeaderboard,
    isConnected,
    connect,
    joinParticipant,
  });

  const [managerHasSyncedState, setManagerHasSyncedState] = useState(
    role !== "manager"
  );
  const [lastManagerQuestionSlideIndex, setLastManagerQuestionSlideIndex] =
    useState(null);
  useEffect(() => {
    if (role !== "manager") return;
    if (managerHasSyncedState) return;

    const hasLiveSignal =
      !!currentQuestion ||
      !!currentContent ||
      hasLeaderboardEntries(leaderboardResults);

    if (hasLiveSignal) {
      setManagerHasSyncedState(true);
      return;
    }

    const timer = setTimeout(() => {
      setManagerHasSyncedState(true);
    }, isConnected ? 2500 : 3500);

    return () => clearTimeout(timer);
  }, [
    role,
    managerHasSyncedState,
    currentQuestion,
    currentContent,
    leaderboardResults,
    isConnected,
  ]);

  // Sync manager slide index with server question id to avoid UI mismatches
  useEffect(() => {
    if (role !== "manager") return;
    if (!currentQuestion || !quiz?.slides?.length) return;

    const idx = quiz.slides.findIndex(
      (slide) =>
        String(slide.question_id ?? slide.question?.question_id ?? "") ===
        String(currentQuestion.question_id ?? "")
    );

    if (idx >= 0) {
      setLastManagerQuestionSlideIndex(idx);
      if (currentSlide !== idx + 1) {
        setCurrentSlide(idx + 1);
      }
    }

    if (data.type !== "ManagerPickAnswerQuestion") {
      setData({ type: "ManagerPickAnswerQuestion" });
    }
  }, [role, currentQuestion, quiz, currentSlide, data.type]);

  useEffect(() => {
    if (role !== "manager") return;
    if (!currentContent) return;

    if (quiz?.slides?.length) {
      const incomingOrder =
        currentContent.order ??
        currentContent.slide_order ??
        currentContent.slideOrder ??
        null;
      const idx = quiz.slides.findIndex(
        (slide) =>
          slide.slide_id === currentContent.slide_id ||
          (incomingOrder != null && slide.order === incomingOrder)
      );

      if (idx >= 0 && currentSlide !== idx + 1) {
        setCurrentSlide(idx + 1);
      }
    }

    if (data.type !== "ManagerContentSlide") {
      setData({ type: "ManagerContentSlide" });
    }
  }, [role, currentContent, quiz, currentSlide, data.type]);

  // Keep the manager route aligned with the authoritative leaderboard state.
  useEffect(() => {
    if (role !== "manager" || !hasLeaderboardEntries(leaderboardResults)) {
      return;
    }

    if (quiz?.slides?.length) {
      let nextLeaderboardIdx = -1;

      if (lastManagerQuestionSlideIndex != null) {
        const questionOrder =
          quiz.slides[lastManagerQuestionSlideIndex]?.order ?? null;
        if (questionOrder != null) {
          nextLeaderboardIdx = quiz.slides.findIndex(
            (slide, idx) =>
              idx !== lastManagerQuestionSlideIndex &&
              !isQuestionSlide(slide) &&
              slide.order === questionOrder
          );
        }

        if (nextLeaderboardIdx < 0) {
          const immediateIdx = lastManagerQuestionSlideIndex + 1;
          if (isLeaderboardSlide(quiz.slides[immediateIdx])) {
            nextLeaderboardIdx = immediateIdx;
          } else {
            nextLeaderboardIdx = quiz.slides.findIndex(
              (slide, idx) =>
                idx > lastManagerQuestionSlideIndex && isLeaderboardSlide(slide)
            );
          }
        }
      }

      if (nextLeaderboardIdx < 0) {
        const currentIdx = Math.max(0, currentSlide - 1);
        if (isLeaderboardSlide(quiz.slides[currentIdx])) {
          nextLeaderboardIdx = currentIdx;
        } else {
          nextLeaderboardIdx = quiz.slides.findIndex(
            (slide) => isLeaderboardSlide(slide)
          );
        }
      }

      if (nextLeaderboardIdx >= 0 && currentSlide !== nextLeaderboardIdx + 1) {
        setCurrentSlide(nextLeaderboardIdx + 1);
      }
    }

    setData({ type: "ManagerLeaderBoard" });
  }, [
    leaderboardResults,
    role,
    quiz,
    currentSlide,
    lastManagerQuestionSlideIndex,
  ]);

  /* ------------------ EXACT NEXT/PREVIOUS FROM YOUR CODE ------------------ */

  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      if (hasLeaderboardEntries(leaderboardResults)) {
        setData({ type: "ManagerLeaderBoard" });
        return;
      }
      if (currentContent) {
        setData({ type: "ManagerContentSlide" });
        return;
      }
      if (currentQuestion) {
        setData({ type: "ManagerPickAnswerQuestion" });
        return;
      }
      setData({ type: "ManagerPickAnswerQuestion" });
    } else {
      // For question -> leaderboard, update index immediately for better presenter UX.
      const nextSlide = quiz.slides[currentSlide];
      if (!nextSlide) return;
      if (isLeaderboardSlide(nextSlide)) {
        setData({ type: "ManagerLeaderBoard" });
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      } else if (isContentSlide(nextSlide)) {
        setData({ type: "ManagerContentSlide" });
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      } else if (isQuestionSlide(nextSlide)) {
        setData({ type: "ManagerPickAnswerQuestion" });
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      }
    }
  };

  // Product requirement: presentation flow is forward-only (no previous step).
  const handlePrevious = () => {};

  const handleEndGame = () => {
    setData({ type: "ManagerFinalLeaderboard" });
  };

  /* ---------------- Manager Rendering (EXACT LIKE ORIGINAL) ---------------- */
  const getManagerRenderType = () => {
    if (data.type === "ManagerFinalLeaderboard" || snapshot?.session?.state === "ended") {
      return "ManagerFinalLeaderboard";
    }
    if (hasLeaderboardEntries(leaderboardResults)) {
      return "ManagerLeaderBoard";
    }
    if (currentContent) {
      return "ManagerContentSlide";
    }
    if (currentQuestion) {
      return "ManagerPickAnswerQuestion";
    }
    return data.type;
  };

  const renderManager = () => {
    switch (getManagerRenderType()) {
      case "ManagerJoinPage":
        return (
          <ManagerJoinPage
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerPickAnswerQuestion":
        return (
          <ManagerPickAnswerQuestion
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            isRemoteReady={isRemoteReady}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerLeaderBoard":
        return (
          <ManagerLeaderBoard
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            isRemoteReady={isRemoteReady}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerContentSlide":
        return (
          <ManagerContentSlide
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            content={currentContent}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerFinalLeaderboard":
        return (
          <FinalLeaderboard
            leaderboardData={modalLeaderboardResults || leaderboardResults}
            quiz={quiz}
            onExit={() => (window.location.href = "/manager/panel")}
          />
        );
      default:
        return <Waiting />;
    }
  };

  /* ---------------- Player Rendering (Server Driven) ---------------- */
  const renderPlayer = () => {
    if (currentContent) {
      return <PlayerContentSlide roomId={roomId} quiz={quiz} content={currentContent} />;
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
    // Do not show stale leaderboard to a fresh player before the quiz has actually started.
    if (hasLeaderboard) {
      return (
        <PlayerLeaderBoard
          roomId={roomId}
          players={leaderboardResults.results || leaderboardResults}
          quiz={quiz}
        />
      );
    }
    if (
      playerHasSeenActiveSlide &&
      playerLastActive?.payload &&
      snapshot?.session?.state === "question_open"
    ) {
      if (playerLastActive.kind === "question") {
        const freshRemaining = snapshot?.session?.remaining_seconds;
        const fallbackQuestion =
          freshRemaining == null
            ? playerLastActive.payload
            : {
                ...playerLastActive.payload,
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

    }

    if (playerHasSeenActiveSlide && playerResumeProfile) {
      return <Waiting message="در حال همگام‌سازی جلسه…" />;
    }
    return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
  };  /* ----------- Final Conditional Rendering ----------- */
  if (role === "manager") {
    return (
      <PresentationErrorBoundary key={`manager-${roomId ?? "unknown"}`}>
        {managerHasSyncedState ? renderManager() : <Waiting message="در حال همگام‌سازی جلسه…" />}
      </PresentationErrorBoundary>
    );
  }

  if (role === "player") {
    return (
      <PresentationErrorBoundary key={`player-${roomId ?? "unknown"}`}>
        {renderPlayer()}
      </PresentationErrorBoundary>
    );
  }

  return <Waiting />;
}

class PresentationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[PresentationErrorBoundary] Runtime error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-xl font-bold">خطا در اجرای ارائه</h2>
          <p className="mt-2 text-sm text-white/70">
            خطایی هنگام اجرا رخ داد. برای بازیابی جلسه، لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            بارگذاری مجدد
          </button>
        </div>
      </div>
    );
  }
}
