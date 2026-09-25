export type QuestionType = "single" | "multiple";
export type EvaluationMode = "none" | "correctness";
export type ScoringMode = "none" | "points";
export type SlideType = 1 | 2 | 3;
export type EditorItemKind =
  | "content"
  | "activity"
  | "question-draft"
  | "legacy-leaderboard";

export interface EditorOption {
  option_id: string;
  text: string;
  is_correct: boolean;
  image_url: string;
  order: number;
}

export interface EditorQuestion {
  question_id: string;
  title: string;
  text: string;
  question_text: string;
  question_type: QuestionType;
  evaluation_mode?: EvaluationMode;
  scoring_mode?: ScoringMode;
  time_limit: number;
  question_time: number;
  min_point: number;
  max_point: number;
  image_url: string;
  question_image: string;
  faster_answers_more_points: boolean;
  partial_scoring: boolean;
  options: EditorOption[];
}

export interface EditorSlide {
  slide_id: string;
  revision: number;
  order: number;
  slide_type: SlideType;
  item_kind?: EditorItemKind;
  activity_kind?: string;
  schema_version?: number;
  show_leaderboard_after: boolean;
  question: EditorQuestion | null;
  title?: string;
  content_text?: string;
  content_image_url?: string;
}

export interface EditorPresentation {
  quiz_id: string;
  revision: number;
  access_code: string;
  title: string;
  quiz_name: string;
  background_color: string;
  background_image_url: string;
  text_color: string;
  music_url: string;
  background: { color: string; image: string; text_color: string };
  slides: EditorSlide[];
  created_at: string;
  last_update: string;
}

export type QuestionLike = Omit<Partial<EditorQuestion>, "options"> & {
  options?: Array<Partial<EditorOption> & { option_text?: string }>;
};

export const QUESTION_LIMITS = {
  title: 500,
  text: 10_000,
  optionText: 2_000,
  optionId: 128,
  imageUrl: 4_096,
  minOptions: 2,
  maxOptions: 100,
  minDurationSeconds: 1,
  maxDurationSeconds: 86_400,
} as const;

export const CONTENT_LIMITS = {
  title: 500,
  text: 20_000,
  imageUrl: 4_096,
} as const;

export type ContentLike = {
  title?: string | null;
  content_text?: string | null;
  content_image_url?: string | null;
};

export type ContentValidationField =
  | "content"
  | "title"
  | "content_text"
  | "content_image";

export type ContentValidationIssue = {
  code: string;
  field: ContentValidationField;
  message: string;
};

export type QuestionValidationField =
  | "question"
  | "question_text"
  | "question_image"
  | "question_type"
  | "options"
  | "option_text"
  | "option_image"
  | "question_time"
  | "points"
  | "partial_scoring";

export type QuestionValidationIssue = {
  code: string;
  field: QuestionValidationField;
  message: string;
  optionId?: string;
};

const textLength = (value: unknown): number =>
  Array.from(String(value ?? "")).length;

export const validateEditorQuestion = (
  question: QuestionLike | null | undefined,
): QuestionValidationIssue[] => {
  if (!question || typeof question !== "object") {
    return [{
      code: "question_required",
      field: "question",
      message: "پیش از اجرا یک سؤال اضافه کنید.",
    }];
  }

  const issues: QuestionValidationIssue[] = [];
  const text = String(question.text ?? question.question_text ?? "").trim();
  const title = String(question.title ?? "");
  const imageUrl = String(question.image_url ?? question.question_image ?? "");

  if (!text) {
    issues.push({
      code: "question_text_required",
      field: "question_text",
      message: "متن سؤال را وارد کنید.",
    });
  } else if (textLength(text) > QUESTION_LIMITS.text) {
    issues.push({
      code: "question_text_too_long",
      field: "question_text",
      message: `متن سؤال نمی‌تواند بیشتر از ${QUESTION_LIMITS.text.toLocaleString("fa-IR")} نویسه باشد.`,
    });
  }

  if (textLength(title) > QUESTION_LIMITS.title) {
    issues.push({
      code: "question_title_too_long",
      field: "question_text",
      message: `عنوان سؤال نمی‌تواند بیشتر از ${QUESTION_LIMITS.title.toLocaleString("fa-IR")} نویسه باشد.`,
    });
  }

  if (textLength(imageUrl) > QUESTION_LIMITS.imageUrl) {
    issues.push({
      code: "question_image_too_long",
      field: "question_image",
      message: "آدرس تصویر سؤال بیش از حد طولانی است.",
    });
  }

  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length < QUESTION_LIMITS.minOptions) {
    issues.push({
      code: "options_too_few",
      field: "options",
      message: "حداقل دو گزینه اضافه کنید.",
    });
  }
  if (options.length > QUESTION_LIMITS.maxOptions) {
    issues.push({
      code: "options_too_many",
      field: "options",
      message: `هر سؤال حداکثر ${QUESTION_LIMITS.maxOptions.toLocaleString("fa-IR")} گزینه می‌تواند داشته باشد.`,
    });
  }

  const ids: string[] = [];
  for (const option of options) {
    const id = String(option.option_id ?? "").trim();
    const optionText = String(option.text ?? option.option_text ?? "").trim();
    const optionImage = String(option.image_url ?? "");

    ids.push(id);

    if (!optionText) {
      issues.push({
        code: "option_text_required",
        field: "option_text",
        optionId: id || undefined,
        message: "برای هر گزینه متن وارد کنید.",
      });
    } else if (textLength(optionText) > QUESTION_LIMITS.optionText) {
      issues.push({
        code: "option_text_too_long",
        field: "option_text",
        optionId: id || undefined,
        message: `متن هر گزینه حداکثر ${QUESTION_LIMITS.optionText.toLocaleString("fa-IR")} نویسه می‌تواند باشد.`,
      });
    }

    if (!id || textLength(id) > QUESTION_LIMITS.optionId) {
      issues.push({
        code: "option_id_invalid",
        field: "options",
        optionId: id || undefined,
        message: "شناسه گزینه معتبر نیست.",
      });
    }

    if (textLength(optionImage) > QUESTION_LIMITS.imageUrl) {
      issues.push({
        code: "option_image_too_long",
        field: "option_image",
        optionId: id || undefined,
        message: "آدرس تصویر گزینه بیش از حد طولانی است.",
      });
    }
  }

  const nonEmptyIds = ids.filter(Boolean);
  if (new Set(nonEmptyIds).size !== nonEmptyIds.length) {
    issues.push({
      code: "option_ids_duplicate",
      field: "options",
      message: "شناسه گزینه‌ها باید یکتا باشد.",
    });
  }

  const type = question.question_type;
  if (type !== "single" && type !== "multiple") {
    issues.push({
      code: "question_type_invalid",
      field: "question_type",
      message: "نوع معتبری برای سؤال انتخاب کنید.",
    });
  }

  const evaluationMode =
    question.evaluation_mode ?? "correctness";
  const scoringMode = question.scoring_mode ?? "points";
  const correctCount = options.filter(
    (option) => option.is_correct === true,
  ).length;

  if (
    evaluationMode !== "none" &&
    evaluationMode !== "correctness"
  ) {
    issues.push({
      code: "evaluation_mode_invalid",
      field: "options",
      message: "حالت ارزیابی فعالیت معتبر نیست.",
    });
  } else if (evaluationMode === "none") {
    if (correctCount !== 0) {
      issues.push({
        code: "correct_answer_not_allowed",
        field: "options",
        message: "فعالیت بدون ارزیابی نباید پاسخ صحیح داشته باشد.",
      });
    }
  } else if (correctCount === 0) {
    issues.push({
      code: "correct_answer_required",
      field: "options",
      message: "حداقل یک گزینه صحیح انتخاب کنید.",
    });
  } else if (type === "single" && correctCount !== 1) {
    issues.push({
      code: "single_correct_answer_required",
      field: "options",
      message: "سؤال تک‌گزینه‌ای دقیقاً یک گزینه صحیح نیاز دارد.",
    });
  }

  if (
    scoringMode !== "none" &&
    scoringMode !== "points"
  ) {
    issues.push({
      code: "scoring_mode_invalid",
      field: "points",
      message: "حالت امتیازدهی فعالیت معتبر نیست.",
    });
  }

  if (
    scoringMode === "points" &&
    evaluationMode !== "correctness"
  ) {
    issues.push({
      code: "scoring_requires_correctness",
      field: "points",
      message: "امتیازدهی نیازمند ارزیابی پاسخ صحیح است.",
    });
  }

  if (
    type === "single" &&
    question.partial_scoring === true
  ) {
    issues.push({
      code: "partial_scoring_not_supported",
      field: "partial_scoring",
      message: "امتیازدهی جزئی فقط برای سؤال چندگزینه‌ای در دسترس است.",
    });
  }

  const duration = Number(question.question_time ?? question.time_limit);
  if (
    !Number.isInteger(duration) ||
    duration < QUESTION_LIMITS.minDurationSeconds ||
    duration > QUESTION_LIMITS.maxDurationSeconds
  ) {
    issues.push({
      code: "question_time_invalid",
      field: "question_time",
      message: "زمان سؤال باید بین ۱ ثانیه تا ۲۴ ساعت باشد.",
    });
  }

  const minPoints = Number(question.min_point);
  const maxPoints = Number(question.max_point);
  if (scoringMode === "none") {
    if (
      minPoints !== 0 ||
      maxPoints !== 0 ||
      question.faster_answers_more_points === true ||
      question.partial_scoring === true
    ) {
      issues.push({
        code: "unscored_policy_invalid",
        field: "points",
        message: "فعالیت بدون امتیاز باید همه تنظیمات امتیازدهی را غیرفعال نگه دارد.",
      });
    }
  } else if (
    scoringMode === "points" &&
    (
      !Number.isSafeInteger(minPoints) ||
      minPoints < 0 ||
      !Number.isSafeInteger(maxPoints) ||
      maxPoints < 1 ||
      minPoints > maxPoints
    )
  ) {
    issues.push({
      code: "points_invalid",
      field: "points",
      message: "امتیازها باید عدد صحیح باشند و ۰ ≤ حداقل ≤ حداکثر.",
    });
  }

  return issues;
};

export const getQuestionValidationError = (
  question: QuestionLike | null | undefined,
): string | null => validateEditorQuestion(question)[0]?.message ?? null;


export const validateEditorContent = (
  content: ContentLike | null | undefined,
): ContentValidationIssue[] => {
  const value = content ?? {};
  const title = String(value.title ?? "");
  const text = String(value.content_text ?? "");
  const imageUrl = String(value.content_image_url ?? "");
  const issues: ContentValidationIssue[] = [];

  if (
    !title.trim() &&
    !text.trim() &&
    !imageUrl.trim()
  ) {
    issues.push({
      code: "content_required",
      field: "content",
      message: "عنوان، متن یا تصویر به اسلاید محتوا اضافه کنید.",
    });
  }

  if (textLength(title) > CONTENT_LIMITS.title) {
    issues.push({
      code: "content_title_too_long",
      field: "title",
      message: `عنوان نمی‌تواند بیشتر از ${CONTENT_LIMITS.title.toLocaleString("fa-IR")} نویسه باشد.`,
    });
  }

  if (textLength(text) > CONTENT_LIMITS.text) {
    issues.push({
      code: "content_text_too_long",
      field: "content_text",
      message: `متن نمی‌تواند بیشتر از ${CONTENT_LIMITS.text.toLocaleString("fa-IR")} نویسه باشد.`,
    });
  }

  if (textLength(imageUrl) > CONTENT_LIMITS.imageUrl) {
    issues.push({
      code: "content_image_too_long",
      field: "content_image",
      message: "آدرس تصویر بیش از حد طولانی است.",
    });
  }

  return issues;
};

export const getContentValidationError = (
  content: ContentLike | null | undefined,
): string | null => validateEditorContent(content)[0]?.message ?? null;
