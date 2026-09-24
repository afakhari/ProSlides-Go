import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { LiveState } from "../api/types.ts";
import { hasLeaderboardEntries } from "../model/leaderboard.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import {
  findContentSlideIndex,
  findLeaderboardSlideIndex,
  findQuestionSlideIndex,
  isContentSlide,
  isLeaderboardSlide,
  isQuestionSlide,
  type ManagerPresentationView,
} from "../model/presentationFlow.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionSlide,
} from "../model/serverData.ts";

type UseManagerPresentationControllerOptions = {
  enabled: boolean;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  leaderboardResults: unknown;
  isConnected: boolean;
  sessionState?: LiveState;
};

export type ManagerPresentationController = {
  view: ManagerPresentationView;
  currentSlide: number;
  totalSlides: number;
  isSynced: boolean;
  handleNext: () => void;
  handlePrevious: () => void;
  handleEndGame: () => void;
};

export function useManagerPresentationController({
  enabled,
  quiz,
  currentQuestion,
  currentContent,
  leaderboardResults,
  isConnected,
  sessionState,
}: UseManagerPresentationControllerOptions): ManagerPresentationController {
  const [fallbackView, setFallbackView] =
    useState<ManagerPresentationView>("ManagerJoinPage");
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isSynced, setIsSynced] = useState(!enabled);
  const [lastQuestionSlideIndex, setLastQuestionSlideIndex] =
    useState<number | null>(null);

  const totalSlides = quiz.slides.length;
  const hasLeaderboard = hasLeaderboardEntries(leaderboardResults);

  useEffect(() => {
    if (!enabled) {
      setIsSynced(true);
      setFallbackView("ManagerJoinPage");
      setCurrentSlide(1);
      setLastQuestionSlideIndex(null);
      return;
    }

    setIsSynced(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isSynced) return;

    if (currentQuestion || currentContent || hasLeaderboard) {
      setIsSynced(true);
      return;
    }

    const timer = window.setTimeout(
      () => setIsSynced(true),
      isConnected ? 2500 : 3500,
    );

    return () => window.clearTimeout(timer);
  }, [
    enabled,
    isSynced,
    currentQuestion,
    currentContent,
    hasLeaderboard,
    isConnected,
  ]);

  useEffect(() => {
    if (!enabled || !currentQuestion || quiz.slides.length === 0) return;

    const index = findQuestionSlideIndex(
      quiz.slides,
      currentQuestion.question_id,
    );

    if (index >= 0) {
      setLastQuestionSlideIndex(index);
      setCurrentSlide(index + 1);
    }

    setFallbackView("ManagerPickAnswerQuestion");
  }, [enabled, currentQuestion, quiz.slides]);

  useEffect(() => {
    if (!enabled || !currentContent) return;

    const index = findContentSlideIndex(quiz.slides, currentContent);
    if (index >= 0) {
      setCurrentSlide(index + 1);
    }

    setFallbackView("ManagerContentSlide");
  }, [enabled, currentContent, quiz.slides]);

  useEffect(() => {
    if (!enabled || !hasLeaderboard) return;

    const index = findLeaderboardSlideIndex({
      slides: quiz.slides,
      currentSlide,
      lastQuestionSlideIndex,
    });

    if (index >= 0) {
      setCurrentSlide(index + 1);
    }

    setFallbackView("ManagerLeaderBoard");
  }, [
    enabled,
    hasLeaderboard,
    quiz.slides,
    currentSlide,
    lastQuestionSlideIndex,
  ]);

  const handleNext = useCallback(() => {
    if (fallbackView === "ManagerJoinPage") {
      if (hasLeaderboard) {
        setFallbackView("ManagerLeaderBoard");
        return;
      }
      if (currentContent) {
        setFallbackView("ManagerContentSlide");
        return;
      }

      setFallbackView("ManagerPickAnswerQuestion");
      return;
    }

    const nextSlide = quiz.slides[currentSlide];
    if (!nextSlide) return;

    if (isLeaderboardSlide(nextSlide)) {
      setFallbackView("ManagerLeaderBoard");
    } else if (isContentSlide(nextSlide)) {
      setFallbackView("ManagerContentSlide");
    } else if (isQuestionSlide(nextSlide)) {
      setFallbackView("ManagerPickAnswerQuestion");
    } else {
      return;
    }

    setCurrentSlide((previous) =>
      Math.min(previous + 1, totalSlides),
    );
  }, [
    fallbackView,
    hasLeaderboard,
    currentContent,
    quiz.slides,
    currentSlide,
    totalSlides,
  ]);

  const handlePrevious = useCallback(() => {
    // Product requirement: presentation flow is forward-only.
  }, []);

  const handleEndGame = useCallback(() => {
    setFallbackView("ManagerFinalLeaderboard");
  }, []);

  const view = useMemo<ManagerPresentationView>(() => {
    if (
      fallbackView === "ManagerFinalLeaderboard" ||
      sessionState === "ended"
    ) {
      return "ManagerFinalLeaderboard";
    }
    if (hasLeaderboard) return "ManagerLeaderBoard";
    if (currentContent) return "ManagerContentSlide";
    if (currentQuestion) return "ManagerPickAnswerQuestion";
    return fallbackView;
  }, [
    fallbackView,
    sessionState,
    hasLeaderboard,
    currentContent,
    currentQuestion,
  ]);

  return {
    view,
    currentSlide,
    totalSlides,
    isSynced,
    handleNext,
    handlePrevious,
    handleEndGame,
  };
}
