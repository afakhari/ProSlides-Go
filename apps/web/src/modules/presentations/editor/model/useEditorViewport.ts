import { useEffect, useState } from "react";

export function useEditorViewport(overlayOpen: boolean) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 767px), (max-height: 600px)");
    const handleChange = () => setIsCompact(media.matches);
    handleChange();

    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("overflow-hidden", isCompact && overlayOpen);
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isCompact, overlayOpen]);

  return isCompact;
}
