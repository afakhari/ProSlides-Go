import type {
  EditorPresentation,
  EditorQuestion,
  EditorSlide,
  EditorTextActivity,
  EvaluationMode,
  QuestionType,
  ScoringMode,
} from "../../model/editor.ts";

export type SlideTypeChoice =
  | "Single Choice"
  | "Multiple Choice"
  | "Content Slide";

export type TypeSelectionMode = QuestionType | "content";
export type IdFactory = () => string;

export type ChoicePolicy = {
  evaluationMode: EvaluationMode;
  scoringMode: ScoringMode;
};

const defaultChoicePolicy: ChoicePolicy = {
  evaluationMode: "correctness",
  scoringMode: "points",
};

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
  policy: ChoicePolicy = defaultChoicePolicy,
): EditorQuestion => {
  const isPoll =
    policy.evaluationMode === "none" &&
    policy.scoringMode === "none";
  const isScored = policy.scoringMode === "points";

  return {
    question_id: slideId,
    title: "",
    text: isPoll ? "نظرسنجی جدید" : "سؤال جدید",
    question_text: isPoll ? "نظرسنجی جدید" : "سؤال جدید",
    question_type: questionType,
    evaluation_mode: policy.evaluationMode,
    scoring_mode: policy.scoringMode,
    min_point: 0,
    max_point: isScored ? 100 : 0,
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
        is_correct: policy.evaluationMode === "correctness",
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
  };
};

export const createDefaultTextActivity = (): EditorTextActivity => ({
  title: "",
  text: "این موضوع را با چه واژه‌هایی توصیف می‌کنید؟",
  image_url: "",
  max_length: 80,
  max_words: 3,
  time_limit: 30,
  aggregation: "word_frequency",
});

export const createTextActivitySlide = (
  order: number,
  createId: IdFactory,
): EditorSlide => ({
  slide_id: createId(),
  revision: 1,
  order,
  slide_type: 1,
  item_kind: "activity",
  activity_kind: "text",
  schema_version: 1,
  show_leaderboard_after: false,
  question: null,
  text_activity: createDefaultTextActivity(),
});

export const createSlideForChoice = (
  order: number,
  choice: SlideTypeChoice,
  createId: IdFactory,
  policy: ChoicePolicy = defaultChoicePolicy,
): EditorSlide => {
  const slideId = createId();
  const mode = slideChoiceToMode(choice);
  const question =
    mode === "content"
      ? null
      : createDefaultQuestion(slideId, mode, createId, policy);

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
    text_activity: null,
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
  text_activity: null,
  title: slide.title || "اسلاید محتوایی جدید",
  content_text: slide.content_text || "",
  content_image_url: slide.content_image_url || "",
  show_leaderboard_after: false,
});

export const convertSlideToTextActivity = (
  slide: EditorSlide,
): EditorSlide => ({
  ...slide,
  slide_type: 1,
  item_kind: "activity",
  activity_kind: "text",
  schema_version: 1,
  show_leaderboard_after: false,
  question: null,
  text_activity:
    slide.activity_kind === "text" && slide.text_activity
      ? slide.text_activity
      : createDefaultTextActivity(),
});

export const convertSlideToQuestion = (
  slide: EditorSlide,
  questionType: QuestionType,
  createId: IdFactory,
  policy?: ChoicePolicy,
): EditorSlide => {
  const existing = slide.question;

  if (!existing?.question_id) {
    return {
      ...slide,
      slide_type: 1,
      item_kind: "activity",
      activity_kind: "choice",
      schema_version: 1,
      text_activity: null,
      question: createDefaultQuestion(
        slide.slide_id,
        questionType,
        createId,
        policy ?? defaultChoicePolicy,
      ),
      show_leaderboard_after: false,
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
    policy?.evaluationMode ?? existing.evaluation_mode ?? "correctness";
  const scoringMode =
    policy?.scoringMode ?? existing.scoring_mode ?? "points";
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

  const maxPoints =
    scoringMode === "none"
      ? 0
      : Math.max(1, Number(existing.max_point) || 100);
  const minPoints =
    scoringMode === "none"
      ? 0
      : Math.min(Math.max(0, Number(existing.min_point) || 0), maxPoints);

  return {
    ...slide,
    slide_type: 1,
    item_kind: "activity",
    activity_kind: "choice",
    schema_version: slide.schema_version ?? 1,
    show_leaderboard_after:
      scoringMode === "points" && slide.show_leaderboard_after === true,
    text_activity: null,
    question: {
      ...existing,
      question_type: questionType,
      evaluation_mode: evaluationMode,
      scoring_mode: scoringMode,
      min_point: minPoints,
      max_point: maxPoints,
      faster_answers_more_points:
        scoringMode === "points" &&
        existing.faster_answers_more_points === true,
      partial_scoring:
        scoringMode === "points" &&
        questionType === "multiple" &&
        existing.partial_scoring === true,
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
