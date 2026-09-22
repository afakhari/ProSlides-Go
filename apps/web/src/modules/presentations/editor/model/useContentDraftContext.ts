import { useContext } from "react";

import { ContentDraftContext } from "./contentDraftContext.ts";

export const useOptionalContentDraft = () =>
  useContext(ContentDraftContext);

export const useRequiredContentDraft = () => {
  const controller = useContext(ContentDraftContext);
  if (!controller) {
    throw new Error(
      "Content draft context is required while editing a content slide.",
    );
  }
  return controller;
};
