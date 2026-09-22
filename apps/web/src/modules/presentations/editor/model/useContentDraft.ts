import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { EditorSlide } from "../../model/editor.ts";
import {
  contentDraftEquals,
  contentDraftReducer,
  createContentDraft,
  type ContentDraft,
} from "./contentDraft.ts";

const requireContentDraft = (slide: EditorSlide): ContentDraft => {
  const draft = createContentDraft(slide);
  if (!draft) {
    throw new Error("Content draft requires a content slide.");
  }
  return draft;
};

export function useContentDraft(slide: EditorSlide) {
  const initial = useMemo(() => requireContentDraft(slide), [slide]);
  const [state, dispatch] = useReducer(contentDraftReducer, {
    baseline: initial,
    draft: initial,
  });

  useEffect(() => {
    dispatch({ type: "reset", draft: initial });
  }, [initial]);

  const dirty = useMemo(
    () => !contentDraftEquals(state.baseline, state.draft),
    [state.baseline, state.draft],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset", draft: state.baseline });
  }, [state.baseline]);

  const markSaved = useCallback((savedSlide: EditorSlide) => {
    dispatch({ type: "saved", draft: requireContentDraft(savedSlide) });
  }, []);

  const setTitle = useCallback((value: string) => {
    dispatch({ type: "title", value });
  }, []);

  const setText = useCallback((value: string) => {
    dispatch({ type: "text", value });
  }, []);

  const setImage = useCallback((value: string) => {
    dispatch({ type: "image", value });
  }, []);

  return {
    draft: state.draft,
    dirty,
    reset,
    markSaved,
    setTitle,
    setText,
    setImage,
  };
}
