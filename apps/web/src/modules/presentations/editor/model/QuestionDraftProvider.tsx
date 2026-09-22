import type { ReactNode } from "react";

import type { EditorSlide } from "../../model/editor.ts";
import { QuestionDraftContext } from "./questionDraftContext.ts";
import { useQuestionDraft } from "./useQuestionDraft.ts";

type QuestionDraftProviderProps = {
  slide: EditorSlide | null;
  active?: boolean;
  children: ReactNode;
};

function ActiveQuestionDraftProvider({
  slide,
  children,
}: {
  slide: EditorSlide;
  children: ReactNode;
}) {
  const controller = useQuestionDraft(slide);

  return (
    <QuestionDraftContext.Provider value={controller}>
      {children}
    </QuestionDraftContext.Provider>
  );
}

export default function QuestionDraftProvider({
  slide,
  active = true,
  children,
}: QuestionDraftProviderProps) {
  if (!active || slide?.slide_type !== 1 || !slide.question) {
    return (
      <QuestionDraftContext.Provider value={null}>
        {children}
      </QuestionDraftContext.Provider>
    );
  }

  return (
    <ActiveQuestionDraftProvider slide={slide}>
      {children}
    </ActiveQuestionDraftProvider>
  );
}
