import { useCallback, useMemo, useReducer } from "react";

export type EditorDirtyArea = "content" | "design" | "audio";
export type EditorSaveState = "saved" | "dirty" | "conflict";

interface EditorStatusState {
  dirty: Record<EditorDirtyArea, boolean>;
  conflictMessage: string | null;
}

type EditorStatusAction =
  | { type: "set-dirty"; area: EditorDirtyArea; dirty: boolean }
  | { type: "clear-dirty" }
  | { type: "conflict"; message: string }
  | { type: "clear-conflict" };

export const initialEditorStatus: EditorStatusState = {
  dirty: { content: false, design: false, audio: false },
  conflictMessage: null,
};

export function editorStatusReducer(state: EditorStatusState, action: EditorStatusAction): EditorStatusState {
  if (action.type === "set-dirty") {
    return { ...state, dirty: { ...state.dirty, [action.area]: action.dirty } };
  }
  if (action.type === "clear-dirty") return { ...state, dirty: initialEditorStatus.dirty };
  if (action.type === "conflict") return { ...state, conflictMessage: action.message };
  if (action.type === "clear-conflict") return { ...state, conflictMessage: null };
  return state;
}

export function useEditorStatus() {
  const [state, dispatch] = useReducer(editorStatusReducer, initialEditorStatus);
  const hasUnsavedChanges = Object.values(state.dirty).some(Boolean);
  const saveState: EditorSaveState = state.conflictMessage ? "conflict" : hasUnsavedChanges ? "dirty" : "saved";
  const setDirty = useCallback((area: EditorDirtyArea, dirty: boolean) => dispatch({ type: "set-dirty", area, dirty }), []);
  const clearDirty = useCallback(() => dispatch({ type: "clear-dirty" }), []);
  const reportConflict = useCallback((message: string) => dispatch({ type: "conflict", message }), []);
  const clearConflict = useCallback(() => dispatch({ type: "clear-conflict" }), []);

  return useMemo(() => ({
    dirty: state.dirty,
    conflictMessage: state.conflictMessage,
    hasUnsavedChanges,
    saveState,
    setDirty,
    clearDirty,
    reportConflict,
    clearConflict,
  }), [state, hasUnsavedChanges, saveState, setDirty, clearDirty, reportConflict, clearConflict]);
}
