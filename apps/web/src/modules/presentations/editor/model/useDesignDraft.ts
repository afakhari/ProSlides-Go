import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { EditorPresentation } from "../../model/editor.ts";
import {
  createDesignDraft,
  designDraftEquals,
  designDraftReducer,
  type DesignDraft,
} from "./designDraft.ts";

const requireDesignDraft = (
  presentation: EditorPresentation,
): DesignDraft => createDesignDraft(presentation);

export function useDesignDraft(
  presentation: EditorPresentation,
) {
  const initial = useMemo(
    () => requireDesignDraft(presentation),
    [presentation],
  );
  const [state, dispatch] = useReducer(designDraftReducer, {
    baseline: initial,
    draft: initial,
  });

  useEffect(() => {
    dispatch({ type: "reset", draft: initial });
  }, [initial]);

  const dirty = useMemo(
    () => !designDraftEquals(state.baseline, state.draft),
    [state.baseline, state.draft],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset", draft: state.baseline });
  }, [state.baseline]);

  const markSaved = useCallback(
    (saved: EditorPresentation) => {
      dispatch({
        type: "saved",
        draft: requireDesignDraft(saved),
      });
    },
    [],
  );

  const setBackgroundColor = useCallback((value: string) => {
    dispatch({ type: "background-color", value });
  }, []);

  const setBackgroundImageUrl = useCallback((value: string) => {
    dispatch({ type: "background-image", value });
  }, []);

  const setTextColor = useCallback((value: string) => {
    dispatch({ type: "text-color", value });
  }, []);

  return {
    draft: state.draft,
    dirty,
    reset,
    markSaved,
    setBackgroundColor,
    setBackgroundImageUrl,
    setTextColor,
  };
}
