import { createContext } from "react";

import type {
  LiveRuntime,
  LiveRuntimeState,
} from "../runtime/LiveRuntime.ts";

type RuntimeCommands = Pick<
  LiveRuntime,
  | "connect"
  | "disconnect"
  | "joinParticipant"
  | "submitAnswer"
  | "sendNavigation"
  | "sendEnd"
  | "loadRoster"
  | "loadMoreRoster"
>;

export type LiveSessionContextValue = LiveRuntimeState &
  RuntimeCommands & {
    participantCount: number;
  };

export const LiveSessionContext =
  createContext<LiveSessionContextValue | null>(null);
