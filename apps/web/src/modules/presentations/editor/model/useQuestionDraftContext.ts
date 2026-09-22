import { useContext } from "react";

import { QuestionDraftContext } from "./questionDraftContext.ts";

export const useOptionalQuestionDraft = () =>
  useContext(QuestionDraftContext);

export const useRequiredQuestionDraft = () => {
  const controller = useContext(QuestionDraftContext);
  if (!controller) {
    throw new Error(
      "Question draft context is required while editing a question slide.",
    );
  }
  return controller;
};
