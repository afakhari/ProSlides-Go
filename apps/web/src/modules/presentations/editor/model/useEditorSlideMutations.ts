import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../../shared/api/http.ts";
import type { NoticeTone } from "../../../../shared/ui/Notice.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type {
  EditorPresentation,
  EditorSlide,
  QuestionType,
  SlideType,
} from "../../model/editor.ts";
import {
  appendPresentationSlide,
  convertSlideToContent,
  convertSlideToQuestion,
  createSlideForChoice,
  activeSlideIdAfterDeletion,
  replacePresentationSlide,
  slideChoiceToMode,
  type SlideTypeChoice,
  type TypeSelectionMode,
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
  setActiveSlideId: (slideId: string | null) => void;
  setActiveSlideType: (slideType: SlideType | null) => void;
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
  setActiveSlideId,
  setActiveSlideType,
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
    useState<TypeSelectionMode | null>(null);
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
      setActiveSlideId(updatedSlide.slide_id);
    },
    [presentation, setActiveSlideId, updatePresentation],
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
            "این اسلاید نتیجه زنده دارد. پیش از تغییر نوع، نتایج ارائه را بازنشانی کنید.",
          );
          return;
        }
      }

      console.error("Editor slide mutation failed:", error);
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
        showNotice("این اسلاید دیگر در ارائه وجود ندارد.", "warning");
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
        setActiveSlideId(nextSlideId);
        await refreshPresentation();
        showNotice("اسلاید حذف شد.", "success");
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
            "این اسلاید نتیجه زنده دارد و در حال حاضر قابل حذف نیست.",
            "warning",
          );
          return;
        }

        console.error("Failed to delete slide:", error);
        showNotice("حذف اسلاید انجام نشد. دوباره تلاش کنید.", "error");
      }
    },
    [
      presentation,
      recoverConflict,
      refreshPresentation,
      setActiveSlideId,
      showNotice,
    ],
  );

  const applyQuestionTypeChange = useCallback(
    async (
      slide: EditorSlide,
      questionType: QuestionType,
      requestedMode: TypeSelectionMode,
    ) => {
      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(requestedMode);

      try {
        const nextSlide = convertSlideToQuestion(
          slide,
          questionType,
          () => globalThis.crypto.randomUUID(),
        );
        const updatedSlide = await quizService.updateSlide(
          presentation.quiz_id,
          slide.slide_id,
          nextSlide,
        );

        applyUpdatedSlide(updatedSlide);
        showTypeNotice(
          `نوع سؤال به ${requestedMode === "single" ? "تک‌گزینه‌ای" : "چندگزینه‌ای"} تغییر کرد.`,
        );
        setShowTypeBox(false);
        activateContentPanel();
      } catch (error) {
        await handleMutationError(
          error,
          "این سؤال جای دیگری تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
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

  const applyContentTypeChange = useCallback(
    async (slide: EditorSlide) => {
      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode("content");

      try {
        const updatedSlide = await quizService.updateSlide(
          presentation.quiz_id,
          slide.slide_id,
          convertSlideToContent(slide),
        );
        applyUpdatedSlide(updatedSlide);
        showTypeNotice("نوع اسلاید به محتوا تغییر کرد.");
        setShowTypeBox(false);
        activateContentPanel();
      } catch (error) {
        await handleMutationError(
          error,
          "این اسلاید جای دیگری تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
          "تبدیل این اسلاید ممکن نشد. دوباره تلاش کنید.",
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
    async (choice: SlideTypeChoice) => {
      if (isSelectingType) return;

      const mode = slideChoiceToMode(choice);
      const newSlide = createSlideForChoice(
        presentation.slides.length,
        choice,
        () => globalThis.crypto.randomUUID(),
      );

      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(mode);

      try {
        const createdSlide = await quizService.createSlide(
          presentation.quiz_id,
          newSlide,
          presentation.revision,
        );
        updatePresentation(
          appendPresentationSlide(presentation, createdSlide),
        );
        setActiveSlideId(createdSlide.slide_id);
        setActiveSlideType(createdSlide.slide_type);
        setShowTypeBox(false);
        activateContentPanel();
        resetCreationGate();
        showNotice("اسلاید ساخته شد.", "success");
      } catch (error) {
        await handleMutationError(
          error,
          "ارائه تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
          "ساخت اسلاید انجام نشد. دوباره تلاش کنید.",
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
      setActiveSlideId,
      setActiveSlideType,
      showNotice,
      updatePresentation,
    ],
  );

  const selectType = useCallback(
    async (choice: SlideTypeChoice) => {
      if (isCreatingSlide) {
        await createSlide(choice);
        return;
      }
      if (!activeSlide || ![1, 2].includes(activeSlide.slide_type)) return;
      if (isSelectingType) return;

      const requestedMode = slideChoiceToMode(choice);

      if (requestedMode === "content") {
        if (activeSlide.slide_type === 2) {
          setShowTypeBox(false);
          activateContentPanel();
          return;
        }

        if (activeSlide.question) {
          requestConfirmation(
            () => {
              void applyContentTypeChange(activeSlide);
            },
            {
              title: "تبدیل به اسلاید محتوایی؟",
              description:
                "سؤال و گزینه‌های آن با محتوا جایگزین می‌شوند. ادامه می‌دهید؟",
              confirmText: "تبدیل",
              cancelText: "انصراف",
            },
          );
          return;
        }

        await applyContentTypeChange(activeSlide);
        return;
      }

      const currentQuestion = activeSlide.question;
      if (activeSlide.slide_type === 2) {
        requestConfirmation(
          () => {
            void applyQuestionTypeChange(
              activeSlide,
              requestedMode,
              requestedMode,
            );
          },
          {
            title: "تبدیل به سؤال؟",
            description:
              "اسلاید محتوایی با یک سؤال جدید جایگزین می‌شود. ادامه می‌دهید؟",
            confirmText: "تبدیل",
            cancelText: "انصراف",
          },
        );
        return;
      }

      if (currentQuestion?.question_type === requestedMode) {
        showTypeNotice(
          `نوع سؤال هم‌اکنون ${requestedMode === "single" ? "تک‌گزینه‌ای" : "چندگزینه‌ای"} است.`,
          2_000,
        );
        setShowTypeBox(false);
        activateContentPanel();
        return;
      }

      if (
        currentQuestion?.question_type === "multiple" &&
        requestedMode === "single"
      ) {
        requestConfirmation(
          () => {
            void applyQuestionTypeChange(
              activeSlide,
              requestedMode,
              requestedMode,
            );
          },
          {
            title: "تغییر به تک‌گزینه‌ای؟",
            description:
              "در حالت تک‌گزینه‌ای فقط یک گزینه صحیح باقی می‌ماند. ادامه می‌دهید؟",
            confirmText: "ادامه",
            cancelText: "انصراف",
          },
        );
        return;
      }

      await applyQuestionTypeChange(
        activeSlide,
        requestedMode,
        requestedMode,
      );
    },
    [
      activeSlide,
      activateContentPanel,
      applyContentTypeChange,
      applyQuestionTypeChange,
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
