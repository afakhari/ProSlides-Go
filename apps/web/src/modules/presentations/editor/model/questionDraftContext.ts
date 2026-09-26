import { createContext } from "react";

import type { useQuestionDraft } from "./useQuestionDraft.ts";

type QuestionDraftController = ReturnType<typeof useQuestionDraft>;

export const QuestionDraftContext =
  createContext<QuestionDraftController | null>(null);
