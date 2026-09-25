import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../../shared/api/http.ts";
import type { NoticeTone } from "../../../../shared/ui/Notice.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type {
  EditorPresentation,
  EditorSlide,
} from "../../model/editor.ts";
import {
  getEditorTypeChoice,
  resolveEditorItemRegistration,
} from "../../model/itemRegistry.ts";
import {
  createEditorSlideForType,
  convertEditorSlideToType,
  editorSlideMatchesTypeChoice,
  getEditorConversionConfirmation,
  type EditorTypeChoiceId,
} from "../registry/editorItemRegistry.ts";
import {
  activeSlideIdAfterDeletion,
  appendPresentationSlide,
  removePresentationSlide,
  replacePresentationSlide,
} from "./slideMutations.ts";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

type UseEditorSlideMutationsOptions = {
  presentation: EditorPresentation;
  activeSlide: EditorSlide | null;
  updatePresentation: (presentation: EditorPresentation) => void;
  refreshPresentation: () => void | Promise<void>;
  selectSlide: (slideId: string | null) => void;
  activateContentPanel: () => void;
  closeSlidesPanel: () => void;
  recoverConflict: () => void | Promise<void>;
  showNotice: (
    message: string,
    tone?: NoticeTone,
    pending?: boolean,
  ) => void;
  requestConfirmation: (
    action: () => void,
    options?: ConfirmOptions,
  ) => void;
};

const TYPE_NOTICE_DURATION_MS = 2_500;

export function useEditorSlideMutations({
  presentation,
  activeSlide,
  updatePresentation,
  refreshPresentation,
  selectSlide,
  activateContentPanel,
  closeSlidesPanel,
  recoverConflict,
  showNotice,
  requestConfirmation,
}: UseEditorSlideMutationsOptions) {
  const [showTypeBox, setShowTypeBox] = useState(false);
  const [isSelectingType, setIsSelectingType] = useState(false);
  const [isAddingSlide, setIsAddingSlide] = useState(false);
  const [isCreatingSlide, setIsCreatingSlide] = useState(false);
  const [typeSelectionError, setTypeSelectionError] = useState<string | null>(
    null,
  );
  const [typeSelectionNotice, setTypeSelectionNotice] = useState<string | null>(
    null,
  );
  const [typeSelectionMode, setTypeSelectionMode] =
    useState<EditorTypeChoiceId | null>(null);
  const addSlideGateRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTypeNotice = useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setTypeSelectionNotice(null);
  }, []);

  const showTypeNotice = useCallback(
    (message: string, duration = TYPE_NOTICE_DURATION_MS) => {
      clearTypeNotice();
      setTypeSelectionNotice(message);
      noticeTimeoutRef.current = setTimeout(() => {
        noticeTimeoutRef.current = null;
        setTypeSelectionNotice(null);
      }, duration);
    },
    [clearTypeNotice],
  );

  useEffect(() => clearTypeNotice, [clearTypeNotice]);

  const applyUpdatedSlide = useCallback(
    (updatedSlide: EditorSlide) => {
      updatePresentation(
        replacePresentationSlide(presentation, updatedSlide),
      );
      selectSlide(updatedSlide.slide_id);
    },
    [presentation, selectSlide, updatePresentation],
  );

  const resetCreationGate = useCallback(() => {
    setIsCreatingSlide(false);
    setIsAddingSlide(false);
    addSlideGateRef.current = false;
  }, []);

  const openTypeSelection = useCallback(() => {
    if (isSelectingType) return;
    setTypeSelectionError(null);
    setTypeSelectionMode(null);
    closeSlidesPanel();
    setShowTypeBox(true);
  }, [closeSlidesPanel, isSelectingType]);

  const beginAddSlide = useCallback(() => {
    if (addSlideGateRef.current) return;
    addSlideGateRef.current = true;
    setIsAddingSlide(true);
    setIsCreatingSlide(true);
    setTypeSelectionError(null);
    setTypeSelectionMode(null);
    setShowTypeBox(true);
  }, []);

  const cancelTypeSelection = useCallback(() => {
    setShowTypeBox(false);
    setTypeSelectionError(null);
    setTypeSelectionMode(null);
    if (isCreatingSlide) resetCreationGate();
  }, [isCreatingSlide, resetCreationGate]);

  const handleMutationError = useCallback(
    async (
      error: unknown,
      conflictMessage: string,
      fallbackMessage: string,
    ) => {
      if (error instanceof ApiError) {
        if (error.isConflict) {
          await recoverConflict();
          setTypeSelectionError(conflictMessage);
          return;
        }
        if (error.code === "slide_has_results") {
          setTypeSelectionError(
            "این آیتم نتیجه زنده دارد. پیش از تغییر نوع، نتایج ارائه را بازنشانی کنید.",
          );
          return;
        }
      }

      console.error("Editor item mutation failed:", error);
      setTypeSelectionError(fallbackMessage);
    },
    [recoverConflict],
  );

  const deleteSlide = useCallback(
    async (slideId: string) => {
      const deletedSlide = presentation.slides.find(
        (slide) => slide.slide_id === slideId,
      );
      if (!deletedSlide) {
        showNotice("این آیتم دیگر در ارائه وجود ندارد.", "warning");
        await refreshPresentation();
        return;
      }

      const nextSlideId = activeSlideIdAfterDeletion(
        presentation.slides,
        slideId,
        activeSlide?.slide_id ?? null,
      );

      try {
        await quizService.deleteSlide(
          presentation.quiz_id,
          slideId,
          deletedSlide.revision,
        );
      } catch (error) {
        if (error instanceof ApiError && error.isConflict) {
          await recoverConflict();
          showNotice(
            "ارائه تغییر کرده بود؛ آخرین نسخه بارگذاری شد و حذف انجام نشد.",
            "warning",
          );
          return;
        }
        if (
          error instanceof ApiError &&
          error.code === "slide_has_results"
        ) {
          showNotice(
            "این آیتم نتیجه زنده دارد و در حال حاضر قابل حذف نیست.",
            "warning",
          );
          return;
        }

        console.error("Failed to delete editor item:", error);
        showNotice("حذف آیتم انجام نشد. دوباره تلاش کنید.", "error");
        return;
      }

      selectSlide(nextSlideId);

      try {
        await refreshPresentation();
        showNotice("آیتم حذف شد.", "success");
      } catch (error) {
        console.error("Item deleted but presentation refresh failed:", error);
        updatePresentation(
          removePresentationSlide(presentation, slideId),
        );
        showNotice(
          "آیتم حذف شد، اما تازه‌سازی ارائه کامل نشد. وضعیت محلی به‌روز شده است.",
          "warning",
        );
      }
    },
    [
      activeSlide?.slide_id,
      presentation,
      recoverConflict,
      refreshPresentation,
      selectSlide,
      showNotice,
      updatePresentation,
    ],
  );

  const applyTypeChange = useCallback(
    async (
      slide: EditorSlide,
      choiceId: EditorTypeChoiceId,
    ) => {
      const choice = getEditorTypeChoice(choiceId);
      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(choiceId);

      try {
        const nextSlide = convertEditorSlideToType(
          slide,
          choiceId,
          () => globalThis.crypto.randomUUID(),
        );
        const updatedSlide = await quizService.updateSlide(
          presentation.quiz_id,
          slide.slide_id,
          nextSlide,
        );

        applyUpdatedSlide(updatedSlide);
        showTypeNotice(`نوع آیتم به «${choice.label}» تغییر کرد.`);
        setShowTypeBox(false);
        activateContentPanel();
      } catch (error) {
        await handleMutationError(
          error,
          "این آیتم جای دیگری تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
          "اعمال این تغییر ممکن نشد. دوباره تلاش کنید.",
        );
      } finally {
        setIsSelectingType(false);
      }
    },
    [
      activateContentPanel,
      applyUpdatedSlide,
      handleMutationError,
      presentation.quiz_id,
      showTypeNotice,
    ],
  );

  const createSlide = useCallback(
    async (choiceId: EditorTypeChoiceId) => {
      if (isSelectingType) return;

      const choice = getEditorTypeChoice(choiceId);
      const newSlide = createEditorSlideForType(
        presentation.slides.length,
        choiceId,
        () => globalThis.crypto.randomUUID(),
      );

      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(choiceId);

      try {
        const createdSlide = await quizService.createSlide(
          presentation.quiz_id,
          newSlide,
          presentation.revision,
        );
        updatePresentation(
          appendPresentationSlide(presentation, createdSlide),
        );
        selectSlide(createdSlide.slide_id);
        setShowTypeBox(false);
        activateContentPanel();
        resetCreationGate();
        showNotice(`«${choice.label}» ساخته شد.`, "success");
      } catch (error) {
        await handleMutationError(
          error,
          "ارائه تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
          "ساخت آیتم انجام نشد. دوباره تلاش کنید.",
        );
      } finally {
        setIsSelectingType(false);
      }
    },
    [
      activateContentPanel,
      handleMutationError,
      isSelectingType,
      presentation,
      resetCreationGate,
      selectSlide,
      showNotice,
      updatePresentation,
    ],
  );

  const selectType = useCallback(
    async (choiceId: EditorTypeChoiceId) => {
      if (isCreatingSlide) {
        await createSlide(choiceId);
        return;
      }
      if (!activeSlide || isSelectingType) return;

      const registration = resolveEditorItemRegistration(activeSlide);
      if (!registration || registration.category === "legacy") {
        setTypeSelectionError(
          "نوع این آیتم قدیمی است و از انتخاب‌گر جدید قابل تبدیل نیست.",
        );
        return;
      }

      if (editorSlideMatchesTypeChoice(activeSlide, choiceId)) {
        const choice = getEditorTypeChoice(choiceId);
        showTypeNotice(`نوع آیتم هم‌اکنون «${choice.label}» است.`, 2_000);
        setShowTypeBox(false);
        activateContentPanel();
        return;
      }

      const confirmation = getEditorConversionConfirmation(
        activeSlide,
        choiceId,
      );
      if (confirmation) {
        requestConfirmation(
          () => {
            void applyTypeChange(activeSlide, choiceId);
          },
          confirmation,
        );
        return;
      }

      await applyTypeChange(activeSlide, choiceId);
    },
    [
      activeSlide,
      activateContentPanel,
      applyTypeChange,
      createSlide,
      isCreatingSlide,
      isSelectingType,
      requestConfirmation,
      showTypeNotice,
    ],
  );

  return {
    showTypeBox,
    isSelectingType,
    isAddingSlide,
    isCreatingSlide,
    typeSelectionError,
    typeSelectionNotice,
    typeSelectionMode,
    beginAddSlide,
    openTypeSelection,
    cancelTypeSelection,
    selectType,
    deleteSlide,
    applyUpdatedSlide,
  };
}
