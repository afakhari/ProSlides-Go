import React, { createContext, useState, useCallback } from "react";

export const ServerDataContext = createContext(null);

export const ServerDataProvider = ({ children }) => {
  // State برای ذخیره داده‌های دریافتی از سرور
  const [serverData, setServerData] = useState({
    users: [], // Type 7: لیست بازیکنان
    questionResults: null, // Type 8: نتایج سوال
    partialQuestionResults: null, // Type 3: partial/result for current question (options_result)
    leaderboardResults: null, // Type 1: نتایج لیدربورد
    currentQuestion: null, // Type 2: سوال فعلی
    lastMessageType: null, // آخرین type دریافتی
    lastUpdateTime: null, // زمان آخرین به‌روزرسانی
  });

  // تابع برای به‌روزرسانی داده‌های بازیکنان (Type 7)
  const updateUsers = useCallback((users) => {
    setServerData((prev) => ({
      ...prev,
      users: users || [],
      lastMessageType: 7,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log("[ServerData] Users updated:", users);
  }, []);

  // تابع برای به‌روزرسانی نتایج سوال (Type 8)
  const updateQuestionResults = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      questionResults: results,
      lastMessageType: 8,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log("[ServerData] Question results updated:", results);
  }, []);

  // تابع برای به‌روزرسانی نتایج جزئی (Type 3)
  const updatePartialQuestionResults = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      partialQuestionResults: results,
      lastMessageType: 3,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log(
      "[ServerData] Partial question results (type 3) updated:",
      results
    );
  }, []);

  // تابع برای به‌روزرسانی لیدربورد (Type 1)
  const updateLeaderboard = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      leaderboardResults: results,
      lastMessageType: 1,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log("[ServerData] Leaderboard updated:", results);
  }, []);

  // تابع برای به‌روزرسانی سوال فعلی (Type 2)
  const updateCurrentQuestion = useCallback((question) => {
    setServerData((prev) => ({
      ...prev,
      currentQuestion: question,
      // reset any partial results from previous question when a new question arrives
      partialQuestionResults: null,
      lastMessageType: 2,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log("[ServerData] Current question updated:", question);
  }, []);

  // تابع کلی برای پردازش پیام از WebSocket
  const processMessage = useCallback(
    (message) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 1: // Leaderboard Results
          if (message.results) {
            updateLeaderboard(message.results);
          }
          break;

        case 2: // New Question
          updateCurrentQuestion(message);
          break;

        case 3: // Partial question result/update (options_result)
          // Some servers send type 3 with only options_result (complementary to type 2)
          // Normalize to { question_id, optionsResult: [...] }
          updatePartialQuestionResults({
            question_id: message.question_id,
            optionsResult:
              message.options_result || message.optionsResult || [],
          });
          break;

        case 7: // Players List
          if (message.users) {
            updateUsers(message.users);
          }
          break;

        case 8: // Question Results
          updateQuestionResults({
            question_id: message.question_id,
            options: message.options || message.submit || [],
          });
          break;

        default:
          console.log("[ServerData] Unhandled message type:", message.type);
      }
    },
    [
      updateUsers,
      updateQuestionResults,
      updateLeaderboard,
      updateCurrentQuestion,
    ]
  );

  // تابع برای پاک کردن داده‌ها
  const clearData = useCallback(() => {
    setServerData({
      users: [],
      questionResults: null,
      partialQuestionResults: null,
      leaderboardResults: null,
      currentQuestion: null,
      lastMessageType: null,
      lastUpdateTime: null,
    });
    console.log("[ServerData] Data cleared");
  }, []);

  const value = {
    // State
    serverData,
    users: serverData.users,
    questionResults: serverData.questionResults,
    partialQuestionResults: serverData.partialQuestionResults,
    leaderboardResults: serverData.leaderboardResults,
    currentQuestion: serverData.currentQuestion,
    lastMessageType: serverData.lastMessageType,
    lastUpdateTime: serverData.lastUpdateTime,

    // Actions
    updateUsers,
    updateQuestionResults,
    updatePartialQuestionResults,
    updateLeaderboard,
    updateCurrentQuestion,
    processMessage,
    clearData,
  };

  return (
    <ServerDataContext.Provider value={value}>
      {children}
    </ServerDataContext.Provider>
  );
};
