import { useContext } from "react";

import { LiveSessionContext } from "./liveSessionContext.ts";
import type { LiveSessionContextValue } from "./liveSessionContext.ts";

export function useLiveSession(): LiveSessionContextValue {
  const context = useContext(LiveSessionContext);
  if (!context) {
    throw new Error(
      "useLiveSession must be used within LiveSessionProvider",
    );
  }
  return context;
}
