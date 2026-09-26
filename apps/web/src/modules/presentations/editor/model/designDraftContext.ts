import { createContext } from "react";

import type { useDesignDraft } from "./useDesignDraft.ts";

type DesignDraftController =
  ReturnType<typeof useDesignDraft>;

export const DesignDraftContext =
  createContext<DesignDraftController | null>(null);
