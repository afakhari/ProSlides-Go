import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createLiveRuntime,
  type LiveClientRole,
} from "../runtime/LiveRuntime.ts";
import { LiveSessionContext } from "./liveSessionContext.ts";

type LiveSessionProviderProps = {
  children: ReactNode;
  role?: LiveClientRole;
};

export function LiveSessionProvider({
  children,
  role = "manager",
}: LiveSessionProviderProps) {
  const runtime = useMemo(() => createLiveRuntime(role), [role]);
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.getState,
    runtime.getState,
  );

  useEffect(() => () => runtime.destroy(), [runtime]);

  const value = useMemo(
    () => ({
      ...state,
      participantCount: state.snapshot?.participant_count ?? 0,
      connect: runtime.connect,
      disconnect: runtime.disconnect,
      joinParticipant: runtime.joinParticipant,
      submitAnswer: runtime.submitAnswer,
      sendNavigation: runtime.sendNavigation,
      sendEnd: runtime.sendEnd,
      loadRoster: runtime.loadRoster,
      loadMoreRoster: runtime.loadMoreRoster,
    }),
    [runtime, state],
  );

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
}
