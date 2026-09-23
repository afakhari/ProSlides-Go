import { useCallback, useEffect, useRef, useState } from "react";

import type { NoticeTone } from "../../../../shared/ui/Notice.tsx";

export type EditorNotice = {
  message: string;
  tone: NoticeTone;
  pending: boolean;
};

export function useEditorNotice() {
  const [notice, setNotice] = useState<EditorNotice | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotice = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNotice(null);
  }, []);

  const showNotice = useCallback((
    message: string,
    tone: NoticeTone = "info",
    pending = false,
  ) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setNotice({ message, tone, pending });

    if (!pending) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setNotice(null);
      }, 3_000);
    }
  }, []);

  useEffect(() => clearNotice, [clearNotice]);

  return { notice, showNotice, clearNotice };
}
