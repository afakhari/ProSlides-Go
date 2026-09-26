import { createContext } from "react";

import type { useWordCloudDraft } from "./useWordCloudDraft.ts";

type WordCloudDraftController = ReturnType<typeof useWordCloudDraft>;

export const WordCloudDraftContext =
  createContext<WordCloudDraftController | null>(null);
