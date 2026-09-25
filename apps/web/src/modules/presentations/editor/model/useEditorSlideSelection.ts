import { useCallback, useEffect, useMemo, useState } from "react";

import type { EditorSlide } from "../../model/editor.ts";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

type UseEditorSlideSelectionOptions = {
  slides: EditorSlide[];
  hasContentChanges: boolean;
  discardContentChanges: () => void;
  closeSlidesPanel: () => void;
  requestConfirmation: (
    action: () => void,
    options?: ConfirmOptions,
  ) => void;
};

const initialSelection = (slides: EditorSlide[]): string | null =>
  slides[0]?.slide_id ?? null;

export function useEditorSlideSelection({
  slides,
  hasContentChanges,
  discardContentChanges,
  closeSlidesPanel,
  requestConfirmation,
}: UseEditorSlideSelectionOptions) {
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(
    () => initialSelection(slides),
  );

  const activeSlide = useMemo(
    () =>
      slides.find((slide) => slide.slide_id === selectedSlideId) ??
      slides[0] ??
      null,
    [selectedSlideId, slides],
  );

  useEffect(() => {
    const nextSlideId = activeSlide?.slide_id ?? null;
    if (selectedSlideId !== nextSlideId) {
      setSelectedSlideId(nextSlideId);
    }
  }, [activeSlide?.slide_id, selectedSlideId]);

  const selectSlideImmediate = useCallback(
    (slideId: string | null) => {
      if (slideId === null) {
        setSelectedSlideId(null);
        return;
      }

      if (!slides.some((slide) => slide.slide_id === slideId)) return;
      setSelectedSlideId(slideId);
    },
    [slides],
  );

  const requestSlideSelection = useCallback(
    (
      slideId: string,
      closePanel = false,
    ) => {
      const changed = slideId !== activeSlide?.slide_id;

      const apply = () => {
        if (changed) discardContentChanges();
        selectSlideImmediate(slideId);
        if (closePanel) closeSlidesPanel();
      };

      if (hasContentChanges && changed) {
        requestConfirmation(apply, {
          title: "تغییرات ذخیره‌نشده",
          description:
            "تغییرات ذخیره‌نشده این آیتم از بین می‌رود. ادامه می‌دهید؟",
          confirmText: "رد تغییرات",
          cancelText: "ادامه ویرایش",
        });
        return;
      }

      apply();
    },
    [
      activeSlide?.slide_id,
      closeSlidesPanel,
      discardContentChanges,
      hasContentChanges,
      requestConfirmation,
      selectSlideImmediate,
    ],
  );

  return {
    activeSlide,
    activeSlideId: activeSlide?.slide_id ?? null,
    selectSlideImmediate,
    requestSlideSelection,
  };
}
