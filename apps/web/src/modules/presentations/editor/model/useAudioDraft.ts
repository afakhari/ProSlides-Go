import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { EditorPresentation } from "../../model/editor.ts";
import {
  audioDraftEquals,
  audioDraftReducer,
  createAudioDraft,
} from "./audioDraft.ts";

export function useAudioDraft(presentation: EditorPresentation) {
  const initial = useMemo(
    () => createAudioDraft(presentation),
    [presentation],
  );
  const [state, dispatch] = useReducer(audioDraftReducer, {
    baseline: initial,
    draft: initial,
  });

  useEffect(() => {
    dispatch({ type: "reset", draft: initial });
  }, [initial]);

  const dirty = useMemo(
    () => !audioDraftEquals(state.baseline, state.draft),
    [state.baseline, state.draft],
  );

  const setMusicUrl = useCallback((value: string) => {
    dispatch({ type: "music-url", value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset", draft: state.baseline });
  }, [state.baseline]);

  const markSaved = useCallback((saved: EditorPresentation) => {
    dispatch({
      type: "saved",
      draft: createAudioDraft(saved),
    });
  }, []);

  return {
    draft: state.draft,
    dirty,
    setMusicUrl,
    reset,
    markSaved,
  };
}
