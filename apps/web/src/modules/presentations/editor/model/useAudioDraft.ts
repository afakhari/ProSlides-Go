import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { EditorPresentation } from "../../model/editor.ts";
import {
  audioDraftEquals,
  audioDraftReducer,
  createAudioDraft,
} from "./audioDraft.ts";

export function useAudioDraft(presentation: EditorPresentation) {
  const initial = createAudioDraft(presentation);
  const [state, dispatch] = useReducer(audioDraftReducer, {
    baseline: initial,
    draft: initial,
  });

  const presentationId = presentation.quiz_id;
  const presentationRevision = presentation.revision;
  const presentationMusicUrl = presentation.music_url;

  useEffect(() => {
    dispatch({
      type: "sync",
      draft: {
        presentationId,
        revision: presentationRevision,
        musicUrl: String(presentationMusicUrl || "").trim(),
      },
    });
  }, [presentationId, presentationRevision, presentationMusicUrl]);

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
