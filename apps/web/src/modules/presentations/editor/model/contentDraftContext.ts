import { createContext } from "react";

import type { useContentDraft } from "./useContentDraft.ts";

export type ContentDraftController = ReturnType<typeof useContentDraft>;

export const ContentDraftContext =
  createContext<ContentDraftController | null>(null);
