/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo, useState } from "react";

import { useLiveSession } from "../hooks/useLiveSession";
import { projectLiveSnapshot } from "../live/protocol";

export const ServerDataContext = createContext(null);

const EMPTY_PROJECTION = {
  participantCount: 0,
  users: [],
  questionResults: null,
  partialQuestionResults: null,
  leaderboardResults: null,
  managerLastLeaderboard: null,
  modalLeaderboardResults: null,
  currentQuestion: null,
  currentContent: null,
};

export const ServerDataProvider = ({ children }) => {
  const { snapshot, roster } = useLiveSession();
  const projection = useMemo(
    () => projectLiveSnapshot(snapshot, roster) || EMPTY_PROJECTION,
    [snapshot, roster],
  );
  const [managerLastLeaderboard, setManagerLastLeaderboard] = useState(null);

  useEffect(() => {
    if (snapshot?.role !== "manager" || !projection.leaderboardResults) return;
    setManagerLastLeaderboard(projection.leaderboardResults);
  }, [projection.leaderboardResults, snapshot?.role]);

  const serverData = useMemo(
    () => ({
      ...EMPTY_PROJECTION,
      ...projection,
      managerLastLeaderboard,
    }),
    [managerLastLeaderboard, projection],
  );

  const value = useMemo(
    () => ({
      serverData,
      ...serverData,
    }),
    [serverData],
  );

  return (
    <ServerDataContext.Provider value={value}>
      {children}
    </ServerDataContext.Provider>
  );
};
