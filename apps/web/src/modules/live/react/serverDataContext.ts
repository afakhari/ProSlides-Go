import { createContext } from "react";

import type { ServerDataValue } from "../model/serverData.ts";

export const ServerDataContext =
  createContext<ServerDataValue | null>(null);
