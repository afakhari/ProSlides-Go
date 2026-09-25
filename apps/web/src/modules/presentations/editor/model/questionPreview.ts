import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import {
  parseDraftInteger,
  validateQuestionDraft,
  type QuestionDraft,
} from "./questionDraft.ts";

export type QuestionPreviewOption = {
  id: string;
  text: string;
  imageUrl: string;
  isCorrect: boolean;
  position: number;
};

export type QuestionPreviewModel = {
  questionText: string;
  questionImageUrl: string;
  typeLabel: string;
  interactionLabel: string;
  durationLabel: string;
  pointsLabel: string;
  optionCountLabel: string;
  options: QuestionPreviewOption[];
  evaluated: boolean;
  scored: boolean;
  fasterAnswersMorePoints: boolean;
  partialScoring: boolean;
  showLeaderboardAfter: boolean;
  validationIssueCount: number;
};

const validDuration = (value: number) =>
  Number.isSafeInteger(value) && value >= 1 && value <= 86_400;

const validPoints = (minPoint: number, maxPoint: number) =>
  Number.isSafeInteger(minPoint) &&
  minPoint >= 0 &&
  Number.isSafeInteger(maxPoint) &&
  maxPoint >= 1 &&
  minPoint <= maxPoint;

export const createQuestionPreviewModel = (
  draft: QuestionDraft,
): QuestionPreviewModel => {
  const duration = parseDraftInteger(draft.timeInput);
  const minPoint = parseDraftInteger(draft.minPointsInput);
  const maxPoint = parseDraftInteger(draft.maxPointsInput);
  const pointsAreValid = validPoints(minPoint, maxPoint);

  const scored = draft.scoringMode === "points";
  const pointsLabel = !scored
    ? "بدون امتیاز"
    : !pointsAreValid
      ? "امتیاز نامعتبر"
      : draft.fasterAnswersMorePoints
        ? `${formatPersianNumber(minPoint)} تا ${formatPersianNumber(maxPoint)} امتیاز`
        : `${formatPersianNumber(maxPoint)} امتیاز`;

  return {
    questionText: draft.text.trim(),
    questionImageUrl: draft.imageUrl.trim(),
    typeLabel:
      draft.type === "single" ? "تک‌گزینه‌ای" : "چندگزینه‌ای",
    interactionLabel:
      draft.type === "single"
        ? "یک گزینه را انتخاب کنید"
        : "می‌توانید چند گزینه انتخاب کنید",
    durationLabel: validDuration(duration)
      ? `${formatPersianNumber(duration)} ثانیه`
      : "زمان نامعتبر",
    pointsLabel,
    optionCountLabel: `${formatPersianNumber(draft.options.length)} گزینه`,
    options: draft.options.map((option, index) => ({
      id: option.id,
      text: option.text.trim(),
      imageUrl: option.imageUrl.trim(),
      isCorrect:
        draft.evaluationMode === "correctness" &&
        option.isCorrect,
      position: index + 1,
    })),
    evaluated: draft.evaluationMode === "correctness",
    scored,
    fasterAnswersMorePoints:
      scored && draft.fasterAnswersMorePoints,
    partialScoring:
      scored &&
      draft.type === "multiple" &&
      draft.partialScoring,
    showLeaderboardAfter: draft.showLeaderboardAfter,
    validationIssueCount: validateQuestionDraft(draft).length,
  };
};
