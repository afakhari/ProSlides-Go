import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { EditorSlide } from "../../model/editor.ts";
import {
  createQuestionDraft,
  questionDraftEquals,
  questionDraftReducer,
  type QuestionDraft,
} from "./questionDraft.ts";

const requireQuestionDraft = (slide: EditorSlide): QuestionDraft => {
  const draft = createQuestionDraft(slide);
  if (!draft) {
    throw new Error("Question draft requires a question slide.");
  }
  return draft;
};

const createOptionId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `option-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function useQuestionDraft(slide: EditorSlide) {
  const initial = useMemo(() => requireQuestionDraft(slide), [slide]);
  const [state, dispatch] = useReducer(questionDraftReducer, {
    baseline: initial,
    draft: initial,
  });

  useEffect(() => {
    dispatch({ type: "reset", draft: initial });
  }, [initial]);

  const dirty = useMemo(
    () => !questionDraftEquals(state.baseline, state.draft),
    [state.baseline, state.draft],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset", draft: state.baseline });
  }, [state.baseline]);

  const markSaved = useCallback((savedSlide: EditorSlide) => {
    dispatch({ type: "saved", draft: requireQuestionDraft(savedSlide) });
  }, []);

  const setQuestionText = useCallback((value: string) => {
    dispatch({ type: "question-text", value });
  }, []);

  const setQuestionImage = useCallback((value: string) => {
    dispatch({ type: "question-image", value });
  }, []);

  const setTimeInput = useCallback((value: string) => {
    dispatch({ type: "time", value });
  }, []);

  const setMinPointsInput = useCallback((value: string) => {
    dispatch({ type: "min-points", value });
  }, []);

  const setMaxPointsInput = useCallback((value: string) => {
    dispatch({ type: "max-points", value });
  }, []);

  const setFasterPoints = useCallback((value: boolean) => {
    dispatch({ type: "faster-points", value });
  }, []);

  const setPartialScoring = useCallback((value: boolean) => {
    dispatch({ type: "partial-scoring", value });
  }, []);

  const setLeaderboard = useCallback((value: boolean) => {
    dispatch({ type: "leaderboard", value });
  }, []);

  const addOption = useCallback(() => {
    dispatch({ type: "add-option", optionId: createOptionId() });
  }, []);

  const deleteOption = useCallback((optionId: string) => {
    dispatch({ type: "delete-option", optionId });
  }, []);

  const setOptionText = useCallback((optionId: string, value: string) => {
    dispatch({ type: "option-text", optionId, value });
  }, []);

  const setOptionImage = useCallback((optionId: string, value: string) => {
    dispatch({ type: "option-image", optionId, value });
  }, []);

  const toggleCorrect = useCallback((optionId: string) => {
    dispatch({ type: "toggle-correct", optionId });
  }, []);

  const moveOption = useCallback((from: number, to: number) => {
    dispatch({ type: "move-option", from, to });
  }, []);

  return {
    draft: state.draft,
    dirty,
    reset,
    markSaved,
    setQuestionText,
    setQuestionImage,
    setTimeInput,
    setMinPointsInput,
    setMaxPointsInput,
    setFasterPoints,
    setPartialScoring,
    setLeaderboard,
    addOption,
    deleteOption,
    setOptionText,
    setOptionImage,
    toggleCorrect,
    moveOption,
  };
}
