import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../../../../shared/api/http.ts";
import type { NoticeTone } from "../../../../shared/ui/Notice.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type { EditorPresentation, EditorSlide } from "../../model/editor.ts";
import {
  presentationAfterReorder,
  reorderEditorSlides,
} from "./slideListModel.ts";

type UseEditorSlideOrderOptions = {
  presentation: EditorPresentation;
  updatePresentation: (presentation: EditorPresentation) => void;
  refreshPresentation: () => void | Promise<void>;
  recoverConflict: () => void | Promise<void>;
  showNotice: (
    message: string,
    tone?: NoticeTone,
    pending?: boolean,
  ) => void;
  disabled?: boolean;
};

export function useEditorSlideOrder({
  presentation,
  updatePresentation,
  refreshPresentation,
  recoverConflict,
  showNotice,
  disabled = false,
}: UseEditorSlideOrderOptions) {
  const [orderedSlides, setOrderedSlides] = useState<EditorSlide[]>(
    presentation.slides,
  );
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    if (!isReordering) setOrderedSlides(presentation.slides);
  }, [isReordering, presentation.slides]);

  const reorderSlides = useCallback(
    async (sourceIndex: number, destinationIndex: number) => {
      if (disabled) {
        showNotice(
          "برای جابه‌جایی اسلایدها ابتدا تغییرات ذخیره‌نشده را ذخیره یا رها کنید.",
          "warning",
        );
        return;
      }
      if (isReordering || sourceIndex === destinationIndex) return;

      const previousSlides = orderedSlides;
      const nextSlides = reorderEditorSlides(
        previousSlides,
        sourceIndex,
        destinationIndex,
      );
      if (nextSlides === previousSlides) return;

      setIsReordering(true);
      setOrderedSlides(nextSlides);

      try {
        await quizService.reorderSlides(
          presentation.quiz_id,
          nextSlides.map((slide) => slide.slide_id),
          presentation.revision,
        );
      } catch (error) {
        setOrderedSlides(previousSlides);
        if (error instanceof ApiError && error.isConflict) {
          await recoverConflict();
          showNotice(
            "ترتیب اسلایدها جای دیگری تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
            "warning",
          );
        } else {
          console.error("Failed to reorder slides:", error);
          showNotice("جابه‌جایی اسلاید انجام نشد.", "error");
        }
        setIsReordering(false);
        return;
      }

      const committed = presentationAfterReorder(
        presentation,
        nextSlides,
      );
      setOrderedSlides(committed.slides);
      updatePresentation(committed);

      try {
        await refreshPresentation();
        showNotice("ترتیب اسلایدها ذخیره شد.", "success");
      } catch (error) {
        console.error("Slides reordered but refresh failed:", error);
        showNotice(
          "ترتیب اسلایدها ذخیره شد، اما تازه‌سازی ارائه کامل نشد. وضعیت محلی به‌روز است.",
          "warning",
        );
      } finally {
        setIsReordering(false);
      }
    },
    [
      disabled,
      isReordering,
      orderedSlides,
      presentation,
      recoverConflict,
      refreshPresentation,
      showNotice,
      updatePresentation,
    ],
  );

  return {
    orderedSlides,
    isReordering,
    reorderSlides,
  };
}
