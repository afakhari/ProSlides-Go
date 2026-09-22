import type { ReactNode } from "react";

import type { EditorPresentation } from "../../model/editor.ts";
import { DesignDraftContext } from "./designDraftContext.ts";
import { useDesignDraft } from "./useDesignDraft.ts";

type DesignDraftProviderProps = {
  presentation: EditorPresentation | null;
  active?: boolean;
  children: ReactNode;
};

function ActiveDesignDraftProvider({
  presentation,
  children,
}: {
  presentation: EditorPresentation;
  children: ReactNode;
}) {
  const controller = useDesignDraft(presentation);

  return (
    <DesignDraftContext.Provider value={controller}>
      {children}
    </DesignDraftContext.Provider>
  );
}

export default function DesignDraftProvider({
  presentation,
  active = true,
  children,
}: DesignDraftProviderProps) {
  if (!active || !presentation) {
    return (
      <DesignDraftContext.Provider value={null}>
        {children}
      </DesignDraftContext.Provider>
    );
  }

  return (
    <ActiveDesignDraftProvider presentation={presentation}>
      {children}
    </ActiveDesignDraftProvider>
  );
}
