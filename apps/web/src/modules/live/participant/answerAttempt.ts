import type { LiveAnswerInput } from "../runtime/LiveRuntime.ts";
import type { LegacyQuestionSlide } from "../model/serverData.ts";

export type ParticipantSubmitState =
  | "idle"
  | "sending"
  | "retryable"
  | "sent"
  | "rejected"
  | "expired";

export const questionRunIdentity = (
  question: LegacyQuestionSlide | null | undefined,
): string | null => {
  if (question?.question_id == null) return null;
  return `${String(question.question_id)}:${String(question.run_id ?? "na")}`;
};

export const toggleParticipantOption = (
  selected: readonly number[],
  index: number,
  multiple: boolean,
): number[] => {
  if (!multiple) {
    return selected.length === 1 && selected[0] === index ? [] : [index];
  }
  return selected.includes(index)
    ? selected.filter((value) => value !== index)
    : [...selected, index].sort((left, right) => left - right);
};

export const buildParticipantAnswer = ({
  question,
  selectedIndexes,
  requestId,
}: {
  question: LegacyQuestionSlide;
  selectedIndexes: readonly number[];
  requestId: string;
}): LiveAnswerInput | null => {
  if (question.question_id == null || selectedIndexes.length === 0) return null;

  const selected = new Set(selectedIndexes);
  return {
    request_id: requestId,
    question_id: question.question_id,
    options_result: (question.options ?? []).map((option, index) => {
      const declaredIndex = Number(option.option_index);
      return {
        option_index: Number.isInteger(declaredIndex) ? declaredIndex : index,
        picked: selected.has(index),
      };
    }),
  };
};
