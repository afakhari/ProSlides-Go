/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { createLiveRuntime } from "../runtime/LiveRuntime";

export const LiveSessionContext = createContext(null);

export const LiveSessionProvider = ({ children, role = "manager" }) => {
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
      participantCount: state.snapshot?.participant_count || 0,
      connect: runtime.connect,
      disconnect: runtime.disconnect,
      joinParticipant: runtime.joinParticipant,
      submitAnswer: runtime.submitAnswer,
      sendNavigation: runtime.sendNavigation,
      sendEnd: runtime.sendEnd,
      loadMoreRoster: runtime.loadMoreRoster,
    }),
    [runtime, state],
  );

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
};
