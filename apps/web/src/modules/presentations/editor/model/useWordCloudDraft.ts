import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { EditorSlide } from "../../model/editor.ts";
import {
  createWordCloudDraft,
  wordCloudDraftEquals,
  wordCloudDraftReducer,
  type WordCloudDraft,
} from "./wordCloudDraft.ts";

const requireWordCloudDraft = (slide: EditorSlide): WordCloudDraft => {
  const draft = createWordCloudDraft(slide);
  if (!draft) {
    throw new Error("Word Cloud draft requires a Text Activity.");
  }
  return draft;
};

export function useWordCloudDraft(slide: EditorSlide) {
  const initial = useMemo(() => requireWordCloudDraft(slide), [slide]);
  const [state, dispatch] = useReducer(wordCloudDraftReducer, {
    baseline: initial,
    draft: initial,
  });

  useEffect(() => {
    dispatch({ type: "reset", draft: initial });
  }, [initial]);

  const dirty = useMemo(
    () => !wordCloudDraftEquals(state.baseline, state.draft),
    [state.baseline, state.draft],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset", draft: state.baseline });
  }, [state.baseline]);

  const markSaved = useCallback((savedSlide: EditorSlide) => {
    dispatch({ type: "saved", draft: requireWordCloudDraft(savedSlide) });
  }, []);

  return {
    draft: state.draft,
    dirty,
    reset,
    markSaved,
    setTitle: useCallback((value: string) => dispatch({ type: "title", value }), []),
    setPrompt: useCallback((value: string) => dispatch({ type: "prompt", value }), []),
    setImage: useCallback((value: string) => dispatch({ type: "image", value }), []),
    setMaxLength: useCallback((value: number) => dispatch({ type: "max-length", value }), []),
    setMaxWords: useCallback((value: number) => dispatch({ type: "max-words", value }), []),
    setDurationSeconds: useCallback((value: number) => dispatch({ type: "duration", value }), []),
  };
}
