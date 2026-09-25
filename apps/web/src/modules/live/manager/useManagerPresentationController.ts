import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { LiveState, StageView } from "../api/types.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import {
  findContentSlideIndex,
  findQuestionSlideIndex,
  findSlideIndexById,
  isContentSlide,
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
  isConnected: boolean;
  sessionState?: LiveState;
  sessionStageView?: StageView;
  activeItemId?: string | null;
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
  isConnected,
  sessionState,
  sessionStageView,
  activeItemId,
}: UseManagerPresentationControllerOptions): ManagerPresentationController {
  const [fallbackView, setFallbackView] =
    useState<ManagerPresentationView>("ManagerJoinPage");
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isSynced, setIsSynced] = useState(!enabled);

  const totalSlides = quiz.slides.length;
  const isOverallRanking = sessionStageView === "overall_ranking";

  useEffect(() => {
    if (!enabled) {
      setIsSynced(true);
      setFallbackView("ManagerJoinPage");
      setCurrentSlide(1);
      return;
    }

    setIsSynced(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isSynced) return;

    if (currentQuestion || currentContent || isOverallRanking) {
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
    isOverallRanking,
    isConnected,
  ]);

  useEffect(() => {
    if (!enabled || !currentQuestion || quiz.slides.length === 0) return;

    const index = findQuestionSlideIndex(
      quiz.slides,
      currentQuestion.question_id,
    );

    if (index >= 0) {
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
    if (!enabled || !isOverallRanking) return;

    const index = findSlideIndexById(quiz.slides, activeItemId);
    if (index >= 0) {
      setCurrentSlide(index + 1);
    }

    setFallbackView("ManagerLeaderBoard");
  }, [
    enabled,
    isOverallRanking,
    quiz.slides,
    activeItemId,
  ]);

  const handleNext = useCallback(() => {
    if (fallbackView === "ManagerJoinPage") {
      if (isOverallRanking) {
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

    if (isContentSlide(nextSlide)) {
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
    isOverallRanking,
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
    if (isOverallRanking) return "ManagerLeaderBoard";
    if (currentContent) return "ManagerContentSlide";
    if (currentQuestion) return "ManagerPickAnswerQuestion";
    return fallbackView;
  }, [
    fallbackView,
    sessionState,
    isOverallRanking,
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
