import { useContext } from "react";

import { WordCloudDraftContext } from "./wordCloudDraftContext.ts";

export const useOptionalWordCloudDraft = () =>
  useContext(WordCloudDraftContext);

export const useRequiredWordCloudDraft = () => {
  const controller = useContext(WordCloudDraftContext);
  if (!controller) {
    throw new Error(
      "Word Cloud draft context is required while editing a Text Activity.",
    );
  }
  return controller;
};
