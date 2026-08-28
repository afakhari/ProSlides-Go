export type QuestionType = "single" | "multiple";
export type SlideType = 1 | 2 | 3;

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

export const getQuestionValidationError = (question: QuestionLike | null | undefined): string | null => {
  if (!question || typeof question !== "object") return "Add a question before presenting.";

  const text = String(question.text ?? question.question_text ?? "").trim();
  if (!text) return "Enter the question text.";

  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length < 2) return "Add at least two options.";
  if (options.length > 100) return "A question can have at most 100 options.";
  if (options.some((option) => !String(option.text ?? option.option_text ?? "").trim())) {
    return "Every option must have text.";
  }
  const ids = options.map((option) => String(option.option_id ?? "").trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    return "Every option must have a unique identifier.";
  }

  const type = question.question_type;
  if (type !== "single" && type !== "multiple") return "Select a valid question type.";
  const correctCount = options.filter((option) => option.is_correct === true).length;
  if (correctCount === 0) return "Select at least one correct option.";
  if (type === "single" && correctCount !== 1) return "Single choice questions need exactly one correct option.";
  if (type === "single" && question.partial_scoring === true) return "Partial scoring is only available for multiple choice questions.";

  const duration = Number(question.question_time ?? question.time_limit);
  if (!Number.isInteger(duration) || duration < 1 || duration > 86400) {
    return "Question time must be between 1 and 86400 seconds.";
  }

  const minPoints = Number(question.min_point);
  const maxPoints = Number(question.max_point);
  if (!Number.isInteger(minPoints) || minPoints < 0 || !Number.isInteger(maxPoints) || maxPoints < 1 || minPoints > maxPoints) {
    return "Points must be whole numbers with 0 <= minimum <= maximum.";
  }

  return null;
};

export const getPresentationValidationError = (presentation: Pick<EditorPresentation, "slides">): string | null => {
  if (!presentation.slides.length) return "Add at least one slide to present.";
  for (const slide of presentation.slides) {
    if (slide.slide_type === 1) {
      const error = getQuestionValidationError(slide.question);
      if (error) return error;
    }
    if (slide.slide_type === 2 && !String(slide.title || slide.content_text || slide.content_image_url || "").trim()) {
      return "Add content to every content slide before presenting.";
    }
  }
  return null;
};
