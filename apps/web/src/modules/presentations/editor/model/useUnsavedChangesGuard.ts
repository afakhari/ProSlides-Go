import { useEffect } from "react";

import { UNSAVED_CHANGES_STORAGE_KEY } from "../../../../shared/browser/storageKeys.ts";

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (hasUnsavedChanges) {
      localStorage.setItem(UNSAVED_CHANGES_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(UNSAVED_CHANGES_STORAGE_KEY);
    }

    return () => {
      localStorage.removeItem(UNSAVED_CHANGES_STORAGE_KEY);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
