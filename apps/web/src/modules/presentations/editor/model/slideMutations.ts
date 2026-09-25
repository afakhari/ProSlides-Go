import type {
  EditorPresentation,
  EditorQuestion,
  EditorSlide,
  QuestionType,
} from "../../model/editor.ts";

export type SlideTypeChoice =
  | "Single Choice"
  | "Multiple Choice"
  | "Content Slide";

export type TypeSelectionMode = QuestionType | "content";
export type IdFactory = () => string;

export const slideChoiceToMode = (
  choice: SlideTypeChoice,
): TypeSelectionMode =>
  choice === "Content Slide"
    ? "content"
    : choice === "Single Choice"
      ? "single"
      : "multiple";

export const createDefaultQuestion = (
  slideId: string,
  questionType: QuestionType,
  createId: IdFactory,
): EditorQuestion => ({
  question_id: slideId,
  title: "",
  text: "سؤال جدید",
  question_text: "سؤال جدید",
  question_type: questionType,
  evaluation_mode: "correctness",
  scoring_mode: "points",
  min_point: 0,
  max_point: 100,
  time_limit: 10,
  question_time: 10,
  image_url: "",
  question_image: "",
  faster_answers_more_points: false,
  partial_scoring: false,
  options: [
    {
      option_id: createId(),
      text: "گزینه ۱",
      is_correct: true,
      image_url: "",
      order: 1,
    },
    {
      option_id: createId(),
      text: "گزینه ۲",
      is_correct: false,
      image_url: "",
      order: 2,
    },
  ],
});

export const createSlideForChoice = (
  order: number,
  choice: SlideTypeChoice,
  createId: IdFactory,
): EditorSlide => {
  const slideId = createId();
  const mode = slideChoiceToMode(choice);
  const question =
    mode === "content"
      ? null
      : createDefaultQuestion(slideId, mode, createId);

  return {
    slide_id: slideId,
    revision: 1,
    order,
    slide_type: mode === "content" ? 2 : 1,
    item_kind: mode === "content" ? "content" : "activity",
    activity_kind: mode === "content" ? undefined : "choice",
    schema_version: mode === "content" ? undefined : 1,
    show_leaderboard_after: false,
    title: mode === "content" ? "اسلاید محتوایی جدید" : "",
    content_text: "",
    content_image_url: "",
    question,
  };
};

export const convertSlideToContent = (
  slide: EditorSlide,
): EditorSlide => ({
  ...slide,
  slide_type: 2,
  item_kind: "content",
  activity_kind: undefined,
  schema_version: undefined,
  question: null,
  title: slide.title || "اسلاید محتوایی جدید",
  content_text: slide.content_text || "",
  content_image_url: slide.content_image_url || "",
  show_leaderboard_after: false,
});

export const convertSlideToQuestion = (
  slide: EditorSlide,
  questionType: QuestionType,
  createId: IdFactory,
): EditorSlide => {
  const existing = slide.question;

  if (!existing?.question_id) {
    return {
      ...slide,
      slide_type: 1,
      item_kind: "activity",
      activity_kind: "choice",
      schema_version: 1,
      question: createDefaultQuestion(slide.slide_id, questionType, createId),
    };
  }

  const options = [...(existing.options || [])];
  while (options.length < 2) {
    options.push({
      option_id: createId(),
      text: `گزینه ${options.length + 1}`,
      is_correct: options.length === 0,
      image_url: "",
      order: options.length + 1,
    });
  }

  const evaluationMode =
    existing.evaluation_mode ?? "correctness";
  const firstCorrectIndex = options.findIndex(
    (option) => option.is_correct,
  );
  const keepCorrectIndex =
    firstCorrectIndex >= 0 ? firstCorrectIndex : 0;
  const normalizedOptions = options.map((option, index) => ({
    ...option,
    is_correct:
      evaluationMode === "none"
        ? false
        : questionType === "single"
          ? index === keepCorrectIndex
          : firstCorrectIndex === -1
            ? index === 0
            : option.is_correct,
    order: index + 1,
  }));

  return {
    ...slide,
    slide_type: 1,
    item_kind: "activity",
    activity_kind: "choice",
    schema_version: slide.schema_version ?? 1,
    question: {
      ...existing,
      question_type: questionType,
      partial_scoring:
        questionType === "multiple" && existing.partial_scoring === true,
      options: normalizedOptions,
    },
  };
};

export const replacePresentationSlide = (
  presentation: EditorPresentation,
  updatedSlide: EditorSlide,
): EditorPresentation => ({
  ...presentation,
  revision: presentation.revision + 1,
  slides: presentation.slides.map((slide) =>
    slide.slide_id === updatedSlide.slide_id ? updatedSlide : slide,
  ),
});

export const appendPresentationSlide = (
  presentation: EditorPresentation,
  createdSlide: EditorSlide,
): EditorPresentation => ({
  ...presentation,
  revision: presentation.revision + 1,
  slides: [...presentation.slides, createdSlide],
});

export const removePresentationSlide = (
  presentation: EditorPresentation,
  deletedSlideId: string,
): EditorPresentation => ({
  ...presentation,
  revision: presentation.revision + 1,
  slides: presentation.slides.filter(
    (slide) => slide.slide_id !== deletedSlideId,
  ),
});

export const activeSlideIdAfterDeletion = (
  slides: EditorSlide[],
  deletedSlideId: string,
  activeSlideId: string | null,
): string | null => {
  if (activeSlideId && activeSlideId !== deletedSlideId) {
    return activeSlideId;
  }

  const deletedIndex = slides.findIndex(
    (slide) => slide.slide_id === deletedSlideId,
  );
  if (deletedIndex < 0) return activeSlideId;

  const remaining = slides.filter(
    (slide) => slide.slide_id !== deletedSlideId,
  );
  return (
    remaining[Math.min(deletedIndex, remaining.length - 1)]?.slide_id ?? null
  );
};
