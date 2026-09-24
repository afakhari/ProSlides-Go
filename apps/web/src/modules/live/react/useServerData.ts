import { useContext } from "react";

import type { ServerDataValue } from "../model/serverData.ts";
import { ServerDataContext } from "./serverDataContext.ts";

export function useServerData(): ServerDataValue {
  const context = useContext(ServerDataContext);
  if (!context) {
    throw new Error(
      "useServerData must be used within ServerDataProvider",
    );
  }
  return context;
}
