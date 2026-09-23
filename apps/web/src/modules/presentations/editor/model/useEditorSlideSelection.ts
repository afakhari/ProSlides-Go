import { useCallback, useEffect, useMemo, useState } from "react";

import type { EditorSlide, SlideType } from "../../model/editor.ts";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

type SlideSelection = {
  slideId: string | null;
  slideType: SlideType | null;
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

const initialSelection = (slides: EditorSlide[]): SlideSelection => ({
  slideId: slides[0]?.slide_id ?? null,
  slideType: slides[0]?.slide_type ?? null,
});

export function useEditorSlideSelection({
  slides,
  hasContentChanges,
  discardContentChanges,
  closeSlidesPanel,
  requestConfirmation,
}: UseEditorSlideSelectionOptions) {
  const [selection, setSelection] = useState<SlideSelection>(
    () => initialSelection(slides),
  );

  const activeSlide = useMemo(
    () =>
      slides.find((slide) => slide.slide_id === selection.slideId) ??
      slides[0] ??
      null,
    [selection.slideId, slides],
  );

  useEffect(() => {
    if (!slides.length) {
      setSelection((current) =>
        current.slideId === null && current.slideType === null
          ? current
          : { slideId: null, slideType: null },
      );
      return;
    }

    const selectedSlide =
      slides.find((slide) => slide.slide_id === selection.slideId) ??
      slides[0];

    const syntheticLeaderboardStillExists =
      selection.slideType === 3 &&
      selectedSlide.slide_type === 1 &&
      selectedSlide.show_leaderboard_after;

    const nextType = syntheticLeaderboardStillExists
      ? 3
      : selectedSlide.slide_type;

    if (
      selectedSlide.slide_id !== selection.slideId ||
      nextType !== selection.slideType
    ) {
      setSelection({
        slideId: selectedSlide.slide_id,
        slideType: nextType,
      });
    }
  }, [selection.slideId, selection.slideType, slides]);

  const selectSlideImmediate = useCallback(
    (slideId: string | null, slideType?: SlideType | null) => {
      if (slideId === null) {
        setSelection({ slideId: null, slideType: null });
        return;
      }

      const slide = slides.find((item) => item.slide_id === slideId);
      if (!slide) return;

      setSelection((current) => ({
        slideId,
        slideType:
          slideType ??
          (current.slideId === slideId ? current.slideType : slide.slide_type),
      }));
    },
    [slides],
  );

  const requestSlideSelection = useCallback(
    (
      slideId: string,
      slideType: SlideType,
      closePanel = false,
    ) => {
      const changed =
        slideId !== selection.slideId || slideType !== selection.slideType;

      const apply = () => {
        if (changed) discardContentChanges();
        selectSlideImmediate(slideId, slideType);
        if (closePanel) closeSlidesPanel();
      };

      if (hasContentChanges && changed) {
        requestConfirmation(apply, {
          title: "تغییرات ذخیره‌نشده",
          description:
            "تغییرات ذخیره‌نشده این اسلاید از بین می‌رود. ادامه می‌دهید؟",
          confirmText: "رد تغییرات",
          cancelText: "ادامه ویرایش",
        });
        return;
      }

      apply();
    },
    [
      closeSlidesPanel,
      discardContentChanges,
      hasContentChanges,
      requestConfirmation,
      selectSlideImmediate,
      selection.slideId,
      selection.slideType,
    ],
  );

  return {
    activeSlide,
    activeSlideId: activeSlide?.slide_id ?? null,
    activeSlideType: selection.slideType,
    selectSlideImmediate,
    requestSlideSelection,
  };
}
