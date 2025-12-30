import React, { createContext, useState, useCallback } from "react";

export const ServerDataContext = createContext(null);

export const ServerDataProvider = ({ children }) => {
  // State برای ذخیره داده‌های دریافتی از سرور
  const [serverData, setServerData] = useState({
    users: [], // Type 7: لیست بازیکنان
    questionResults: null, // Type 8: نتایج سوال
    partialQuestionResults: null, // Type 3: partial/result for current question (options_result)
    leaderboardResults: null, // Type 1: نتایج لیدربورد
    managerLastLeaderboard: null, // آخرین لیدربورد معتبر برای منیجر
    modalLeaderboardResults: null, // Type 12: نتایج لیدربورد برای modal
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
      managerLastLeaderboard: results, // ذخیره آخرین لیدربورد معتبر
      currentQuestion: null, // پاک کردن سوال فعلی تا لیدربورد نمایش داده شود
      lastMessageType: 1,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log("[ServerData] Leaderboard updated:", results);
  }, []);

  // تابع برای به‌روزرسانی لیدربورد modal (Type 12)
  const updateModalLeaderboard = useCallback((results) => {
    setServerData((prev) => ({
      ...prev,
      modalLeaderboardResults: results,
      lastMessageType: 12,
      lastUpdateTime: new Date().toISOString(),
    }));
    console.log("[ServerData] Modal Leaderboard (Type 12) updated:", results);
  }, []);

  // تابع برای به‌روزرسانی سوال فعلی (Type 2)
  const updateCurrentQuestion = useCallback((question) => {
    setServerData((prev) => ({
      ...prev,
      currentQuestion: question,
      leaderboardResults: null, // پاک کردن لیدربورد تا سوال نمایش داده شود
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
      if (!message) return;

      // اگر پیام فقط results دارد و type ندارد، آن را به عنوان لیدربورد در نظر بگیر
      if (!message.type && message.results && Array.isArray(message.results)) {
        console.log(
          "[ServerData] Leaderboard message received (no type field):",
          message.results.length,
          "players"
        );
        updateLeaderboard(message.results);
        return;
      }

      if (!message.type) return;

      switch (message.type) {
        case 1: // Leaderboard Results
        case 11: // Leaderboard Results (Type 11)
          console.log("[ServerData] Type 1/11 received, message:", message);
          if (message.results) {
            updateLeaderboard(message.results);
          } else {
            console.warn(
              "[ServerData] Type 1/11 received but no results field"
            );
          }
          break;

        case 12: // Modal Leaderboard Results
          console.log("[ServerData] Type 12 received, message:", message);
          if (message.results) {
            updateModalLeaderboard(message.results);
          } else {
            console.warn("[ServerData] Type 12 received but no results field");
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
            optionsResult: message.options || message.submit || [],
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
      updateModalLeaderboard,
      updateCurrentQuestion,
      updatePartialQuestionResults,
    ]
  );

  // تابع برای پاک کردن داده‌ها
  const clearData = useCallback(() => {
    setServerData({
      users: [],
      questionResults: null,
      partialQuestionResults: null,
      leaderboardResults: null,
      managerLastLeaderboard: null,
      modalLeaderboardResults: null,
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
    managerLastLeaderboard: serverData.managerLastLeaderboard,
    modalLeaderboardResults: serverData.modalLeaderboardResults,
    currentQuestion: serverData.currentQuestion,
    lastMessageType: serverData.lastMessageType,
    lastUpdateTime: serverData.lastUpdateTime,

    // Actions
    updateUsers,
    updateQuestionResults,
    updatePartialQuestionResults,
    updateLeaderboard,
    updateModalLeaderboard,
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
