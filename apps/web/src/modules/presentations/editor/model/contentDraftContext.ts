import { createContext } from "react";

import type { useContentDraft } from "./useContentDraft.ts";

type ContentDraftController = ReturnType<typeof useContentDraft>;

export const ContentDraftContext =
  createContext<ContentDraftController | null>(null);
