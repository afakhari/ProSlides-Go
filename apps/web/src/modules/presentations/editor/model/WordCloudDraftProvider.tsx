import type { ReactNode } from "react";

import type { EditorSlide } from "../../model/editor.ts";
import { WordCloudDraftContext } from "./wordCloudDraftContext.ts";
import { useWordCloudDraft } from "./useWordCloudDraft.ts";

type WordCloudDraftProviderProps = {
  slide: EditorSlide | null;
  active?: boolean;
  children: ReactNode;
};

function ActiveWordCloudDraftProvider({
  slide,
  children,
}: {
  slide: EditorSlide;
  children: ReactNode;
}) {
  const controller = useWordCloudDraft(slide);
  return (
    <WordCloudDraftContext.Provider value={controller}>
      {children}
    </WordCloudDraftContext.Provider>
  );
}

export default function WordCloudDraftProvider({
  slide,
  active = true,
  children,
}: WordCloudDraftProviderProps) {
  if (
    !active ||
    slide?.activity_kind !== "text" ||
    !slide.text_activity
  ) {
    return (
      <WordCloudDraftContext.Provider value={null}>
        {children}
      </WordCloudDraftContext.Provider>
    );
  }

  return (
    <ActiveWordCloudDraftProvider slide={slide}>
      {children}
    </ActiveWordCloudDraftProvider>
  );
}
