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
  convertSlideToTextActivity,
  createSlideForChoice,
  createTextActivitySlide,
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
  const choice = getEditorTypeChoice(choiceId);
  if (choice.registrationKey === "content") {
    return createSlideForChoice(order, "Content Slide", createId);
  }
  if (choice.registrationKey === "text") {
    return createTextActivitySlide(order, createId);
  }

  return createSlideForChoice(
    order,
    choice.questionType === "multiple" ? "Multiple Choice" : "Single Choice",
    createId,
    {
      evaluationMode: choice.evaluationMode ?? "correctness",
      scoringMode: choice.scoringMode ?? "points",
    },
  );
};

export const editorSlideMatchesTypeChoice = (
  slide: EditorSlide,
  choiceId: EditorTypeChoiceId,
): boolean => {
  const choice = getEditorTypeChoice(choiceId);
  const registration = resolveEditorItemRegistration(slide);
  if (registration?.key !== choice.registrationKey) return false;

  if (choice.registrationKey === "text") {
    return (
      slide.activity_kind === "text" &&
      slide.schema_version === 1 &&
      Boolean(slide.text_activity)
    );
  }

  if (choice.registrationKey === "choice") {
    const question = slide.question;
    if (!question) return false;

    const questionTypeMatches =
      choiceId === "poll" ||
      question.question_type === choice.questionType;

    return (
      questionTypeMatches &&
      (question.evaluation_mode ?? "correctness") ===
        (choice.evaluationMode ?? "correctness") &&
      (question.scoring_mode ?? "points") ===
        (choice.scoringMode ?? "points")
    );
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
  if (choice.registrationKey === "text") {
    return convertSlideToTextActivity(slide);
  }

  const targetQuestionType =
    choiceId === "poll"
      ? slide.question?.question_type ?? choice.questionType ?? "single"
      : choice.questionType ?? "single";

  return convertSlideToQuestion(
    slide,
    targetQuestionType,
    createId,
    {
      evaluationMode: choice.evaluationMode ?? "correctness",
      scoringMode: choice.scoringMode ?? "points",
    },
  );
};

export const getEditorConversionConfirmation = (
  slide: EditorSlide,
  choiceId: EditorTypeChoiceId,
): EditorConversionConfirmation | null => {
  if (editorSlideMatchesTypeChoice(slide, choiceId)) return null;

  const currentRegistration = resolveEditorItemRegistration(slide);

  if (choiceId === "content") {
    return slide.question || slide.text_activity
      ? {
          title: "تبدیل به اسلاید محتوایی؟",
          description:
            "فعالیت تعاملی فعلی با محتوای غیرتعاملی جایگزین می‌شود. ادامه می‌دهید؟",
          confirmText: "تبدیل",
          cancelText: "انصراف",
        }
      : null;
  }

  if (choiceId === "word-cloud") {
    return {
      title: "تبدیل به ابر واژه؟",
      description:
        "تنظیمات نوع قبلی با یک فعالیت متنی بدون پاسخ صحیح و امتیاز جایگزین می‌شود. نتیجه بر اساس فراوانی واژه‌ها خواهد بود.",
      confirmText: "تبدیل",
      cancelText: "انصراف",
    };
  }

  if (currentRegistration?.key === "content") {
    return {
      title: choiceId === "poll" ? "تبدیل به نظرسنجی؟" : "تبدیل به فعالیت انتخابی؟",
      description:
        choiceId === "poll"
          ? "محتوای فعلی با یک نظرسنجی بدون پاسخ صحیح و امتیاز جایگزین می‌شود. ادامه می‌دهید؟"
          : "محتوای فعلی با یک فعالیت انتخابی جدید جایگزین می‌شود. ادامه می‌دهید؟",
      confirmText: "تبدیل",
      cancelText: "انصراف",
    };
  }

  if (currentRegistration?.key === "text") {
    return {
      title: choiceId === "poll" ? "تبدیل به نظرسنجی؟" : "تبدیل به سؤال انتخابی؟",
      description:
        "پرسش و تنظیمات ابر واژه با گزینه‌های انتخابی جدید جایگزین می‌شود. ادامه می‌دهید؟",
      confirmText: "تبدیل",
      cancelText: "انصراف",
    };
  }

  const currentIsPoll =
    slide.question?.evaluation_mode === "none" &&
    slide.question?.scoring_mode === "none";
  const targetIsPoll = choiceId === "poll";

  if (currentRegistration?.key === "choice" && currentIsPoll !== targetIsPoll) {
    return targetIsPoll
      ? {
          title: "تبدیل به نظرسنجی؟",
          description:
            "گزینه‌ها حفظ می‌شوند، اما پاسخ صحیح، امتیازدهی و نمایش رتبه‌بندی کلی برای این فعالیت حذف می‌شود.",
          confirmText: "تبدیل",
          cancelText: "انصراف",
        }
      : {
          title: "تبدیل به سؤال امتیازی؟",
          description:
            "گزینه‌ها حفظ می‌شوند و فعالیت دوباره پاسخ صحیح و امتیاز خواهد داشت. در صورت نبود پاسخ صحیح، گزینه اول به‌عنوان پاسخ صحیح اولیه انتخاب می‌شود.",
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
