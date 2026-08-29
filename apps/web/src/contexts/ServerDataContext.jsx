/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useMemo, useState } from "react";
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
  lastUpdateName: null,
  lastUpdateTime: null,
};

export const ServerDataProvider = ({ children }) => {
  const [serverData, setServerData] = useState(EMPTY_PROJECTION);

  const applyLiveSnapshot = useCallback((snapshot, roster = []) => {
    const projection = projectLiveSnapshot(snapshot, roster);
    if (!projection) return;
    setServerData((previous) => ({
      ...previous,
      ...projection,
      managerLastLeaderboard:
        snapshot.role === "manager" && projection.leaderboardResults
          ? projection.leaderboardResults
          : previous.managerLastLeaderboard,
      lastUpdateName: "live_snapshot",
      lastUpdateTime: new Date().toISOString(),
    }));
  }, []);

  const applyLiveEvent = useCallback((event) => {
    if (event?.name !== "answer.stats" || !event.payload) return;
    const counts = event.payload.option_counts || {};
    setServerData((previous) => ({
      ...previous,
      questionResults: {
        question_id: event.payload.question_slide_id,
        optionsResult: Object.entries(counts).map(([optionId, count]) => ({
          option_id: Number(optionId),
          number_of_submits: Number(count),
        })),
      },
      lastUpdateName: event.name,
      lastUpdateTime: new Date().toISOString(),
    }));
  }, []);

  const value = useMemo(() => ({
    serverData,
    ...serverData,
    applyLiveSnapshot,
    applyLiveEvent,
  }), [serverData, applyLiveSnapshot, applyLiveEvent]);

  return <ServerDataContext.Provider value={value}>{children}</ServerDataContext.Provider>;
};
