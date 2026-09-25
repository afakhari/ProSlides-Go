import type { EditorSlide } from "../../model/editor.ts";
import {
  editorTypeChoices,
  getEditorTypeChoice,
  resolveEditorItemRegistration,
  type EditorTypeChoiceId,
} from "../../model/itemRegistry.ts";
import {
  convertSlideToContent,
  convertSlideToQuestion,
  createSlideForChoice,
  type IdFactory,
} from "../model/slideMutations.ts";

export { editorTypeChoices };
export type { EditorTypeChoiceId };

export type EditorConversionConfirmation = {
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
};

export const createEditorSlideForType = (
  order: number,
  choiceId: EditorTypeChoiceId,
  createId: IdFactory,
): EditorSlide => {
  switch (choiceId) {
    case "content":
      return createSlideForChoice(order, "Content Slide", createId);
    case "choice-single":
      return createSlideForChoice(order, "Single Choice", createId);
    case "choice-multiple":
      return createSlideForChoice(order, "Multiple Choice", createId);
  }
};

export const editorSlideMatchesTypeChoice = (
  slide: EditorSlide,
  choiceId: EditorTypeChoiceId,
): boolean => {
  const choice = getEditorTypeChoice(choiceId);
  const registration = resolveEditorItemRegistration(slide);
  if (registration?.key !== choice.registrationKey) return false;

  if (choice.registrationKey === "choice") {
    return slide.question?.question_type === choice.questionType;
  }
  return true;
};

export const convertEditorSlideToType = (
  slide: EditorSlide,
  choiceId: EditorTypeChoiceId,
  createId: IdFactory,
): EditorSlide => {
  const choice = getEditorTypeChoice(choiceId);

  if (choice.registrationKey === "content") {
    return convertSlideToContent(slide);
  }

  return convertSlideToQuestion(
    slide,
    choice.questionType ?? "single",
    createId,
  );
};

export const getEditorConversionConfirmation = (
  slide: EditorSlide,
  choiceId: EditorTypeChoiceId,
): EditorConversionConfirmation | null => {
  if (editorSlideMatchesTypeChoice(slide, choiceId)) return null;

  const currentRegistration = resolveEditorItemRegistration(slide);

  if (choiceId === "content") {
    return slide.question
      ? {
          title: "تبدیل به اسلاید محتوایی؟",
          description:
            "فعالیت انتخابی و گزینه‌های آن با محتوای غیرتعاملی جایگزین می‌شوند. ادامه می‌دهید؟",
          confirmText: "تبدیل",
          cancelText: "انصراف",
        }
      : null;
  }

  if (currentRegistration?.key === "content") {
    return {
      title: "تبدیل به فعالیت انتخابی؟",
      description:
        "محتوای فعلی با یک فعالیت انتخابی جدید جایگزین می‌شود. ادامه می‌دهید؟",
      confirmText: "تبدیل",
      cancelText: "انصراف",
    };
  }

  if (
    slide.question?.question_type === "multiple" &&
    slide.question.evaluation_mode !== "none" &&
    choiceId === "choice-single"
  ) {
    return {
      title: "تغییر به تک‌گزینه‌ای؟",
      description:
        "در حالت تک‌گزینه‌ای فقط یک گزینه صحیح باقی می‌ماند. ادامه می‌دهید؟",
      confirmText: "ادامه",
      cancelText: "انصراف",
    };
  }

  return null;
};
