import { createContext } from "react";

import type { useDesignDraft } from "./useDesignDraft.ts";

export type DesignDraftController =
  ReturnType<typeof useDesignDraft>;

export const DesignDraftContext =
  createContext<DesignDraftController | null>(null);
