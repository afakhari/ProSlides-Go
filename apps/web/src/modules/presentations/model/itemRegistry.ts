import {
  getContentValidationError,
  getQuestionValidationError,
  type EditorPresentation,
  type EditorSlide,
  type QuestionType,
} from "./editor.ts";

export type EditorItemRegistryKey =
  | "content"
  | "choice"
  | "legacy-leaderboard";

export type EditorItemCategory = "content" | "activity" | "legacy";

export type EditorTypeChoiceId =
  | "content"
  | "choice-single"
  | "choice-multiple";

export type EditorTypeChoice = {
  id: EditorTypeChoiceId;
  registrationKey: Exclude<EditorItemRegistryKey, "legacy-leaderboard">;
  label: string;
  description: string;
  questionType?: QuestionType;
};

export type EditorItemBehavior = {
  id: "activity-result" | "overall-ranking";
  label: string;
  tone: "info" | "warning";
};

export type EditorItemRegistration = {
  key: EditorItemRegistryKey;
  category: EditorItemCategory;
  label: string;
  matches: (slide: EditorSlide) => boolean;
  isConfigured: (slide: EditorSlide) => boolean;
  getTitle: (slide: EditorSlide) => string;
  getTypeLabel: (slide: EditorSlide) => string;
  validate: (slide: EditorSlide) => string | null;
  getBehaviors: (slide: EditorSlide) => EditorItemBehavior[];
};

const contentRegistration: EditorItemRegistration = {
  key: "content",
  category: "content",
  label: "محتوا",
  matches: (slide) => slide.slide_type === 2,
  isConfigured: (slide) => slide.slide_type === 2,
  getTitle: (slide) =>
    slide.title?.trim() ||
    slide.content_text?.trim() ||
    "اسلاید محتوا",
  getTypeLabel: () => "محتوا",
  validate: (slide) => getContentValidationError(slide),
  getBehaviors: () => [],
};

const choiceRegistration: EditorItemRegistration = {
  key: "choice",
  category: "activity",
  label: "فعالیت انتخابی",
  matches: (slide) => slide.slide_type === 1,
  isConfigured: (slide) =>
    slide.slide_type === 1 &&
    Boolean(slide.question) &&
    (slide.question?.question_type === "single" ||
      slide.question?.question_type === "multiple"),
  getTitle: (slide) =>
    slide.question?.text?.trim() ||
    slide.question?.question_text?.trim() ||
    "فعالیت انتخابی",
  getTypeLabel: (slide) =>
    slide.question?.question_type === "multiple"
      ? "چندگزینه‌ای"
      : slide.question?.question_type === "single"
        ? "تک‌گزینه‌ای"
        : "انتخاب نوع فعالیت",
  validate: (slide) => getQuestionValidationError(slide.question),
  getBehaviors: (slide) => [
    {
      id: "activity-result",
      label: "نتیجه فعالیت",
      tone: "info",
    },
    ...(slide.show_leaderboard_after
      ? [{
          id: "overall-ranking" as const,
          label: "رتبه‌بندی کلی",
          tone: "warning" as const,
        }]
      : []),
  ],
};

const legacyLeaderboardRegistration: EditorItemRegistration = {
  key: "legacy-leaderboard",
  category: "legacy",
  label: "جدول امتیازات قدیمی",
  matches: (slide) => slide.slide_type === 3,
  isConfigured: () => true,
  getTitle: (slide) => slide.title?.trim() || "جدول امتیازات قدیمی",
  getTypeLabel: () => "قدیمی",
  validate: () => null,
  getBehaviors: () => [],
};

export const contentRegistry = [contentRegistration] as const;
export const activityRegistry = [choiceRegistration] as const;

const editorItemRegistrations: readonly EditorItemRegistration[] = [
  ...contentRegistry,
  ...activityRegistry,
  legacyLeaderboardRegistration,
];

export const editorTypeChoices: readonly EditorTypeChoice[] = [
  {
    id: "choice-single",
    registrationKey: "choice",
    label: "تک‌گزینه‌ای",
    description: "یک پاسخ صحیح؛ نتیجه فعالیت پس از بسته‌شدن نمایش داده می‌شود.",
    questionType: "single",
  },
  {
    id: "choice-multiple",
    registrationKey: "choice",
    label: "چندگزینه‌ای",
    description: "چند پاسخ صحیح؛ نتیجه فعالیت پس از بسته‌شدن نمایش داده می‌شود.",
    questionType: "multiple",
  },
  {
    id: "content",
    registrationKey: "content",
    label: "اسلاید محتوایی",
    description: "نمایش متن و تصویر بدون دریافت پاسخ.",
  },
];

export const resolveEditorItemRegistration = (
  slide: EditorSlide | null | undefined,
): EditorItemRegistration | null => {
  if (!slide) return null;
  return (
    editorItemRegistrations.find((registration) =>
      registration.matches(slide),
    ) ?? null
  );
};

export const getEditorTypeChoice = (
  choiceId: EditorTypeChoiceId,
): EditorTypeChoice => {
  const choice = editorTypeChoices.find((item) => item.id === choiceId);
  if (!choice) {
    throw new Error(`Unsupported editor item type: ${choiceId}`);
  }
  return choice;
};

export const getEditorItemTitle = (slide: EditorSlide): string =>
  resolveEditorItemRegistration(slide)?.getTitle(slide) ??
  "آیتم بدون نوع";

export const getEditorItemTypeLabel = (slide: EditorSlide): string =>
  resolveEditorItemRegistration(slide)?.getTypeLabel(slide) ??
  "شناخته‌نشده";

export const getEditorItemBehaviors = (
  slide: EditorSlide,
): EditorItemBehavior[] =>
  resolveEditorItemRegistration(slide)?.getBehaviors(slide) ?? [];

export const getPresentationValidationError = (
  presentation: Pick<EditorPresentation, "slides">,
): string | null => {
  if (!presentation.slides.length) {
    return "برای اجرا حداقل یک اسلاید اضافه کنید.";
  }

  for (const slide of presentation.slides) {
    const registration = resolveEditorItemRegistration(slide);
    if (!registration) {
      return "نوع یکی از آیتم‌های ارائه شناخته‌شده نیست.";
    }
    if (registration.category === "legacy") {
      continue;
    }
    const error = registration.validate(slide);
    if (error) return error;
  }

  return null;
};
