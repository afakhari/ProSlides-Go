import type { ReactNode } from "react";

import type { EditorSlide } from "../../model/editor.ts";
import { ContentDraftContext } from "./contentDraftContext.ts";
import { useContentDraft } from "./useContentDraft.ts";

type ContentDraftProviderProps = {
  slide: EditorSlide | null;
  active?: boolean;
  children: ReactNode;
};

function ActiveContentDraftProvider({
  slide,
  children,
}: {
  slide: EditorSlide;
  children: ReactNode;
}) {
  const controller = useContentDraft(slide);

  return (
    <ContentDraftContext.Provider value={controller}>
      {children}
    </ContentDraftContext.Provider>
  );
}

export default function ContentDraftProvider({
  slide,
  active = true,
  children,
}: ContentDraftProviderProps) {
  if (!active || slide?.slide_type !== 2) {
    return (
      <ContentDraftContext.Provider value={null}>
        {children}
      </ContentDraftContext.Provider>
    );
  }

  return (
    <ActiveContentDraftProvider slide={slide}>
      {children}
    </ActiveContentDraftProvider>
  );
}
