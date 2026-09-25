import { normalizeDigits } from "../../../../shared/forms/numbers.ts";
import {
  QUESTION_LIMITS,
  validateEditorQuestion,
  type EditorQuestion,
  type EditorSlide,
  type EvaluationMode,
  type QuestionType,
  type ScoringMode,
  type QuestionValidationIssue,
} from "../../model/editor.ts";

export type QuestionDraftOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  imageUrl: string;
};

export type QuestionDraft = {
  slideId: string;
  revision: number;
  order: number;
  showLeaderboardAfter: boolean;
  questionId: string;
  title: string;
  text: string;
  type: QuestionType;
  evaluationMode: EvaluationMode;
  scoringMode: ScoringMode;
  timeInput: string;
  minPointsInput: string;
  maxPointsInput: string;
  imageUrl: string;
  fasterAnswersMorePoints: boolean;
  partialScoring: boolean;
  options: QuestionDraftOption[];
};

export type QuestionDraftState = {
  baseline: QuestionDraft;
  draft: QuestionDraft;
};

export type QuestionDraftAction =
  | { type: "reset"; draft: QuestionDraft }
  | { type: "saved"; draft: QuestionDraft }
  | { type: "question-text"; value: string }
  | { type: "question-image"; value: string }
  | { type: "time"; value: string }
  | { type: "min-points"; value: string }
  | { type: "max-points"; value: string }
  | { type: "faster-points"; value: boolean }
  | { type: "partial-scoring"; value: boolean }
  | { type: "leaderboard"; value: boolean }
  | { type: "add-option"; optionId: string }
  | { type: "delete-option"; optionId: string }
  | { type: "option-text"; optionId: string; value: string }
  | { type: "option-image"; optionId: string; value: string }
  | { type: "toggle-correct"; optionId: string }
  | { type: "move-option"; from: number; to: number };

const formatInteger = (value: number): string =>
  new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);

export const normalizeIntegerInput = (value: string): string =>
  normalizeDigits(value).replace(/[٬،,\s]/g, "");

export const parseDraftInteger = (value: string): number => {
  const normalized = normalizeIntegerInput(value).trim();
  if (!/^\d+$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
};

const normalizeQuestion = (question: EditorQuestion): EditorQuestion => ({
  ...question,
  text: question.question_text ?? question.text ?? "",
  question_text: question.question_text ?? question.text ?? "",
  image_url: question.question_image || question.image_url || "",
  question_image: question.question_image || question.image_url || "",
  time_limit: Number(question.question_time ?? question.time_limit ?? 10),
  question_time: Number(question.question_time ?? question.time_limit ?? 10),
});

export const createQuestionDraft = (slide: EditorSlide): QuestionDraft | null => {
  if (slide.slide_type !== 1 || !slide.question) return null;
  const question = normalizeQuestion(slide.question);

  return {
    slideId: slide.slide_id,
    revision: slide.revision,
    order: slide.order,
    showLeaderboardAfter: slide.show_leaderboard_after === true,
    questionId: question.question_id,
    title: question.title || "",
    text: question.question_text || "",
    type: question.question_type,
    evaluationMode:
      question.evaluation_mode ?? "correctness",
    scoringMode:
      question.scoring_mode ?? "points",
    timeInput: formatInteger(question.question_time),
    minPointsInput: formatInteger(question.min_point),
    maxPointsInput: formatInteger(question.max_point),
    imageUrl: question.question_image || "",
    fasterAnswersMorePoints: question.faster_answers_more_points === true,
    partialScoring:
      question.question_type === "multiple" && question.partial_scoring === true,
    options: (question.options || []).map((option) => ({
      id: String(option.option_id),
      text: option.text || "",
      isCorrect: option.is_correct === true,
      imageUrl: option.image_url || "",
    })),
  };
};

const patchDraft = (
  state: QuestionDraftState,
  patch: Partial<QuestionDraft>,
): QuestionDraftState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

const ensureCorrectOption = (
  options: QuestionDraftOption[],
  type: QuestionType,
  evaluationMode: EvaluationMode,
): QuestionDraftOption[] => {
  if (evaluationMode === "none") {
    return options.map((option) => ({
      ...option,
      isCorrect: false,
    }));
  }

  if (!options.length || options.some((option) => option.isCorrect)) {
    return type === "single" &&
      options.filter((option) => option.isCorrect).length > 1
      ? options.map((option, index) => ({
          ...option,
          isCorrect: index === 0,
        }))
      : options;
  }

  return options.map((option, index) => ({
    ...option,
    isCorrect: index === 0,
  }));
};

export function questionDraftReducer(
  state: QuestionDraftState,
  action: QuestionDraftAction,
): QuestionDraftState {
  switch (action.type) {
    case "reset":
      return { baseline: action.draft, draft: action.draft };
    case "saved":
      return { baseline: action.draft, draft: action.draft };
    case "question-text":
      return patchDraft(state, { text: action.value });
    case "question-image":
      return patchDraft(state, { imageUrl: action.value });
    case "time":
      return patchDraft(state, { timeInput: action.value });
    case "min-points":
      return patchDraft(state, { minPointsInput: action.value });
    case "max-points":
      return patchDraft(state, { maxPointsInput: action.value });
    case "faster-points":
      return patchDraft(state, { fasterAnswersMorePoints: action.value });
    case "partial-scoring":
      return patchDraft(state, {
        partialScoring: state.draft.type === "multiple" && action.value,
      });
    case "leaderboard":
      return patchDraft(state, { showLeaderboardAfter: action.value });
    case "add-option": {
      if (state.draft.options.length >= QUESTION_LIMITS.maxOptions) return state;
      const nextOption: QuestionDraftOption = {
        id: action.optionId,
        text: `گزینه ${state.draft.options.length + 1}`,
        isCorrect:
          state.draft.evaluationMode === "correctness" &&
          state.draft.options.length === 0,
        imageUrl: "",
      };
      return patchDraft(state, {
        options: [...state.draft.options, nextOption],
      });
    }
    case "delete-option": {
      if (state.draft.options.length <= QUESTION_LIMITS.minOptions) return state;
      const remaining = state.draft.options.filter(
        (option) => option.id !== action.optionId,
      );
      return patchDraft(state, {
        options: ensureCorrectOption(
          remaining,
          state.draft.type,
          state.draft.evaluationMode,
        ),
      });
    }
    case "option-text":
      return patchDraft(state, {
        options: state.draft.options.map((option) =>
          option.id === action.optionId
            ? { ...option, text: action.value }
            : option,
        ),
      });
    case "option-image":
      return patchDraft(state, {
        options: state.draft.options.map((option) =>
          option.id === action.optionId
            ? { ...option, imageUrl: action.value }
            : option,
        ),
      });
    case "toggle-correct": {
      if (state.draft.evaluationMode === "none") return state;

      const selected = state.draft.options.find(
        (option) => option.id === action.optionId,
      );
      if (!selected) return state;

      if (state.draft.type === "single") {
        return patchDraft(state, {
          options: state.draft.options.map((option) => ({
            ...option,
            isCorrect: option.id === action.optionId,
          })),
        });
      }

      const correctCount = state.draft.options.filter(
        (option) => option.isCorrect,
      ).length;
      if (selected.isCorrect && correctCount === 1) return state;

      return patchDraft(state, {
        options: state.draft.options.map((option) =>
          option.id === action.optionId
            ? { ...option, isCorrect: !option.isCorrect }
            : option,
        ),
      });
    }
    case "move-option": {
      if (
        action.from === action.to ||
        action.from < 0 ||
        action.to < 0 ||
        action.from >= state.draft.options.length ||
        action.to >= state.draft.options.length
      ) {
        return state;
      }
      const options = [...state.draft.options];
      const [moved] = options.splice(action.from, 1);
      options.splice(action.to, 0, moved);
      return patchDraft(state, { options });
    }
    default:
      return state;
  }
}

export const questionDraftEquals = (
  left: QuestionDraft,
  right: QuestionDraft,
): boolean =>
  left.slideId === right.slideId &&
  left.revision === right.revision &&
  left.order === right.order &&
  left.showLeaderboardAfter === right.showLeaderboardAfter &&
  left.questionId === right.questionId &&
  left.title === right.title &&
  left.text === right.text &&
  left.type === right.type &&
  left.evaluationMode === right.evaluationMode &&
  left.scoringMode === right.scoringMode &&
  left.timeInput === right.timeInput &&
  left.minPointsInput === right.minPointsInput &&
  left.maxPointsInput === right.maxPointsInput &&
  left.imageUrl === right.imageUrl &&
  left.fasterAnswersMorePoints === right.fasterAnswersMorePoints &&
  left.partialScoring === right.partialScoring &&
  left.options.length === right.options.length &&
  left.options.every((option, index) => {
    const other = right.options[index];
    return (
      option.id === other?.id &&
      option.text === other.text &&
      option.isCorrect === other.isCorrect &&
      option.imageUrl === other.imageUrl
    );
  });

const draftQuestionLike = (draft: QuestionDraft) => ({
  title: draft.title,
  text: draft.text,
  question_text: draft.text,
  question_type: draft.type,
  evaluation_mode: draft.evaluationMode,
  scoring_mode: draft.scoringMode,
  question_time: parseDraftInteger(draft.timeInput),
  time_limit: parseDraftInteger(draft.timeInput),
  min_point: parseDraftInteger(draft.minPointsInput),
  max_point: parseDraftInteger(draft.maxPointsInput),
  image_url: draft.imageUrl,
  question_image: draft.imageUrl,
  faster_answers_more_points: draft.fasterAnswersMorePoints,
  partial_scoring: draft.partialScoring,
  options: draft.options.map((option, index) => ({
    option_id: option.id,
    text: option.text,
    is_correct: option.isCorrect,
    image_url: option.imageUrl,
    order: index + 1,
  })),
});

export const validateQuestionDraft = (
  draft: QuestionDraft,
): QuestionValidationIssue[] => validateEditorQuestion(draftQuestionLike(draft));

export const questionDraftToEditorSlide = (
  draft: QuestionDraft,
): EditorSlide => {
  const issues = validateQuestionDraft(draft);
  if (issues.length) {
    throw new Error(issues[0].message);
  }

  const questionTime = parseDraftInteger(draft.timeInput);
  const minPoint = parseDraftInteger(draft.minPointsInput);
  const maxPoint = parseDraftInteger(draft.maxPointsInput);
  const question: EditorQuestion = {
    question_id: draft.questionId,
    title: draft.title,
    text: draft.text.trim(),
    question_text: draft.text.trim(),
    question_type: draft.type,
    evaluation_mode: draft.evaluationMode,
    scoring_mode: draft.scoringMode,
    time_limit: questionTime,
    question_time: questionTime,
    min_point:
      draft.scoringMode === "none" ? 0 : minPoint,
    max_point:
      draft.scoringMode === "none" ? 0 : maxPoint,
    image_url: draft.imageUrl.trim(),
    question_image: draft.imageUrl.trim(),
    faster_answers_more_points:
      draft.scoringMode === "points" &&
      draft.fasterAnswersMorePoints,
    partial_scoring:
      draft.scoringMode === "points" &&
      draft.type === "multiple" &&
      draft.partialScoring,
    options: draft.options.map((option, index) => ({
      option_id: option.id,
      text: option.text.trim(),
      is_correct:
        draft.evaluationMode === "correctness" &&
        option.isCorrect,
      image_url: option.imageUrl.trim(),
      order: index + 1,
    })),
  };

  return {
    slide_id: draft.slideId,
    revision: draft.revision,
    order: draft.order,
    slide_type: 1,
    show_leaderboard_after: draft.showLeaderboardAfter,
    question,
  };
};
