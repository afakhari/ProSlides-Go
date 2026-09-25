import {
  getContentValidationError,
  getQuestionValidationError,
  getTextActivityValidationError,
  type EditorPresentation,
  type EditorSlide,
  type EvaluationMode,
  type QuestionType,
  type ScoringMode,
} from "./editor.ts";

export type EditorItemRegistryKey =
  | "content"
  | "choice"
  | "text";

export type EditorItemCategory = "content" | "activity";

export type EditorTypeChoiceId =
  | "content"
  | "poll"
  | "word-cloud"
  | "choice-single"
  | "choice-multiple";

export type EditorTypeChoice = {
  id: EditorTypeChoiceId;
  registrationKey: EditorItemRegistryKey;
  label: string;
  description: string;
  questionType?: QuestionType;
  evaluationMode?: EvaluationMode;
  scoringMode?: ScoringMode;
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
  matches: (slide) => slide.item_kind === "content",
  isConfigured: (slide) => slide.item_kind === "content",
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
  matches: (slide) =>
    slide.item_kind === "activity" &&
    slide.activity_kind === "choice" &&
    slide.schema_version === 1,
  isConfigured: (slide) =>
    slide.item_kind === "activity" &&
    slide.activity_kind === "choice" &&
    slide.schema_version === 1 &&
    Boolean(slide.question) &&
    (slide.question?.question_type === "single" ||
      slide.question?.question_type === "multiple"),
  getTitle: (slide) =>
    slide.question?.text?.trim() ||
    slide.question?.question_text?.trim() ||
    "فعالیت انتخابی",
  getTypeLabel: (slide) =>
    slide.question?.evaluation_mode === "none" &&
      slide.question?.scoring_mode === "none"
      ? "نظرسنجی"
      : slide.question?.question_type === "multiple"
        ? "چندگزینه‌ای"
        : slide.question?.question_type === "single"
          ? "تک‌گزینه‌ای"
          : "انتخاب نوع فعالیت",
  validate: (slide) => {
    const questionError = getQuestionValidationError(slide.question);
    if (questionError) return questionError;

    if (
      slide.show_leaderboard_after &&
      slide.question?.scoring_mode === "none"
    ) {
      return "رتبه‌بندی کلی فقط پس از فعالیت امتیازی قابل نمایش است.";
    }

    return null;
  },
  getBehaviors: (slide) => {
    if (!slide.question) return [];

    return [
      {
        id: "activity-result",
        label: "نتیجه فعالیت",
        tone: "info",
      },
      ...(slide.show_leaderboard_after &&
      slide.question.scoring_mode !== "none"
        ? [{
            id: "overall-ranking" as const,
            label: "رتبه‌بندی کلی",
            tone: "warning" as const,
          }]
        : []),
    ];
  },
};

const textRegistration: EditorItemRegistration = {
  key: "text",
  category: "activity",
  label: "فعالیت متنی",
  matches: (slide) =>
    slide.item_kind === "activity" &&
    slide.activity_kind === "text" &&
    slide.schema_version === 1,
  isConfigured: (slide) => Boolean(slide.text_activity),
  getTitle: (slide) =>
    slide.text_activity?.text?.trim() ||
    "ابر واژه",
  getTypeLabel: () => "ابر واژه",
  validate: (slide) => {
    const error = getTextActivityValidationError(slide.text_activity);
    if (error) return error;
    if (slide.show_leaderboard_after) {
      return "ابر واژه امتیازی نیست و رتبه‌بندی کلی پس از آن نمایش داده نمی‌شود.";
    }
    return null;
  },
  getBehaviors: () => [{
    id: "activity-result",
    label: "ابر واژه نتیجه",
    tone: "info",
  }],
};

export const contentRegistry = [contentRegistration] as const;
export const activityRegistry = [choiceRegistration, textRegistration] as const;

const editorItemRegistrations: readonly EditorItemRegistration[] = [
  ...contentRegistry,
  ...activityRegistry,
];

export const editorTypeChoices: readonly EditorTypeChoice[] = [
  {
    id: "poll",
    registrationKey: "choice",
    label: "نظرسنجی",
    description:
      "انتخاب بدون پاسخ صحیح و امتیاز؛ نتیجه به‌صورت توزیع پاسخ‌ها نمایش داده می‌شود.",
    questionType: "single",
    evaluationMode: "none",
    scoringMode: "none",
  },
  {
    id: "word-cloud",
    registrationKey: "text",
    label: "ابر واژه",
    description:
      "شرکت‌کنندگان چند واژه می‌فرستند و نتیجه بر اساس فراوانی واژه‌ها شکل می‌گیرد.",
  },
  {
    id: "choice-single",
    registrationKey: "choice",
    label: "تک‌گزینه‌ای",
    description: "یک پاسخ صحیح؛ نتیجه فعالیت پس از بسته‌شدن نمایش داده می‌شود.",
    questionType: "single",
    evaluationMode: "correctness",
    scoringMode: "points",
  },
  {
    id: "choice-multiple",
    registrationKey: "choice",
    label: "چندگزینه‌ای",
    description: "چند پاسخ صحیح؛ نتیجه فعالیت پس از بسته‌شدن نمایش داده می‌شود.",
    questionType: "multiple",
    evaluationMode: "correctness",
    scoringMode: "points",
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
    const error = registration.validate(slide);
    if (error) return error;
  }

  return null;
};
